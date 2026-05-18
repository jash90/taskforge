import { useEffect, useState } from 'react';
import { Download, Monitor, Apple, Loader2, AlertCircle } from 'lucide-react';

interface GitHubAsset {
  name: string;
  size: number;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  html_url: string;
  assets: GitHubAsset[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pl-PL', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

type Platform = 'windows' | 'macos-arm' | 'macos-intel' | 'linux';
type Format =
  | 'msi'
  | 'exe'
  | 'portable'
  | 'dmg'
  | 'app-tar'
  | 'appimage'
  | 'deb'
  | 'rpm'
  | 'other';

interface AssetMeta {
  platform: Platform;
  format: Format;
  label: string;
}

function classify(name: string): AssetMeta {
  const lo = name.toLowerCase();
  if (lo.endsWith('.msi')) return { platform: 'windows', format: 'msi', label: 'Windows · MSI (instalator)' };
  if (lo.includes('portable') && lo.endsWith('.zip')) return { platform: 'windows', format: 'portable', label: 'Windows · portable (ZIP)' };
  if (lo.endsWith('.exe')) return { platform: 'windows', format: 'exe', label: 'Windows · instalator (EXE)' };
  if (lo.includes('aarch64') && lo.endsWith('.dmg')) return { platform: 'macos-arm', format: 'dmg', label: 'macOS · Apple Silicon (DMG)' };
  if (lo.includes('x64') && lo.endsWith('.dmg')) return { platform: 'macos-intel', format: 'dmg', label: 'macOS · Intel (DMG)' };
  if (lo.endsWith('.dmg')) return { platform: 'macos-arm', format: 'dmg', label: 'macOS (DMG)' };
  if (lo.includes('aarch64') && lo.endsWith('.app.tar.gz')) return { platform: 'macos-arm', format: 'app-tar', label: 'macOS · Apple Silicon (.app)' };
  if (lo.includes('x64') && lo.endsWith('.app.tar.gz')) return { platform: 'macos-intel', format: 'app-tar', label: 'macOS · Intel (.app)' };
  if (lo.endsWith('.appimage')) return { platform: 'linux', format: 'appimage', label: 'Linux · AppImage' };
  if (lo.endsWith('.deb')) return { platform: 'linux', format: 'deb', label: 'Linux · DEB (Debian/Ubuntu)' };
  if (lo.endsWith('.rpm')) return { platform: 'linux', format: 'rpm', label: 'Linux · RPM (Fedora/openSUSE)' };
  return { platform: 'windows', format: 'other', label: name };
}

function platformIcon(p: Platform) {
  if (p === 'macos-arm' || p === 'macos-intel') return <Apple size={20} />;
  return <Monitor size={20} />;
}

const PLATFORM_ORDER: Record<Platform, number> = {
  windows: 0,
  'macos-arm': 100,
  'macos-intel': 200,
  linux: 300,
};
const FORMAT_ORDER: Record<Format, number> = {
  msi: 0,
  exe: 1,
  portable: 2,
  dmg: 0,
  'app-tar': 1,
  appimage: 0,
  deb: 1,
  rpm: 2,
  other: 9,
};

function sortKey(meta: AssetMeta): number {
  return PLATFORM_ORDER[meta.platform] + FORMAT_ORDER[meta.format];
}

export default function DownloadPage() {
  const [release, setRelease] = useState<GitHubRelease | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('https://api.github.com/repos/jash90/taskforge/releases/latest', { cache: 'no-store' })
      .then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then((data: GitHubRelease) => setRelease(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const items = release
    ? release.assets
        .map((asset) => ({ asset, meta: classify(asset.name) }))
        .sort((a, b) => sortKey(a.meta) - sortKey(b.meta))
    : [];

  return (
    <div className="download-page">
      <header className="download-hero">
        <div className="download-hero-icon">
          <Download size={32} />
        </div>
        <h1 className="download-hero-title">Pobierz TaskForge</h1>

        {loading && <p className="text-muted mt-4"><Loader2 size={16} className="animate-spin inline-block mr-2" />Ładowanie…</p>}

        {error && (
          <div className="card download-error-card mt-6">
            <AlertCircle size={20} className="text-danger" />
            <div>
              <p className="font-semibold text-danger">Nie udało się załadować</p>
              <p className="text-sm text-muted">{error}</p>
            </div>
            <a href="https://github.com/jash90/taskforge/releases" target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm ml-auto">
              Otwórz na GitHub
            </a>
          </div>
        )}

        {release && (
          <p className="download-hero-version">
            Najnowsza wersja: <strong>{release.tag_name}</strong>
            <span className="text-muted ml-2">({formatDate(release.published_at)})</span>
          </p>
        )}
      </header>

      {release && (
        <div className="download-platforms">
          {items.map(({ asset, meta }) => (
            <div key={asset.name} className="download-platform-card card">
              <div className="download-platform-icon">{platformIcon(meta.platform)}</div>
              <div className="download-platform-body">
                <h3 className="download-platform-label">{meta.label}</h3>
                <a href={asset.browser_download_url} className="btn btn-primary btn-sm download-btn" download>
                  <Download size={14} />
                  Pobierz
                  <span className="download-btn-size">{formatBytes(asset.size)}</span>
                </a>
                <p className="download-asset-filename">{asset.name}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <footer className="download-footer">
        <p className="text-sm text-muted">
          Wszystkie pliki z&nbsp;
          <a href="https://github.com/jash90/taskforge/releases" target="_blank" rel="noopener noreferrer" className="text-accent">
            github.com/jash90/taskforge/releases
          </a>
        </p>
      </footer>
    </div>
  );
}
