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

function detectPlatform(name: string): { platform: Platform; label: string } {
  const lo = name.toLowerCase();
  if (lo.endsWith('.exe')) return { platform: 'windows', label: 'Windows (instalator)' };
  if (lo.endsWith('.msi')) return { platform: 'windows', label: 'Windows (MSI)' };
  if (lo.includes('portable') && lo.endsWith('.zip')) return { platform: 'windows', label: 'Windows (portable)' };
  if (lo.includes('aarch64') && (lo.endsWith('.dmg') || lo.includes('.app.tar'))) return { platform: 'macos-arm', label: 'macOS Apple Silicon' };
  if (lo.includes('x64') && (lo.endsWith('.dmg') || lo.includes('.app.tar'))) return { platform: 'macos-intel', label: 'macOS Intel' };
  if (lo.endsWith('.dmg')) return { platform: 'macos-arm', label: 'macOS' };
  if (lo.endsWith('.appimage')) return { platform: 'linux', label: 'Linux (AppImage)' };
  if (lo.endsWith('.deb')) return { platform: 'linux', label: 'Linux (DEB)' };
  if (lo.endsWith('.rpm')) return { platform: 'linux', label: 'Linux (RPM)' };
  return { platform: 'windows', label: name };
}

function platformIcon(p: Platform) {
  if (p === 'macos-arm' || p === 'macos-intel') return <Apple size={20} />;
  if (p === 'linux') return <Monitor size={20} />;
  return <Monitor size={20} />;
}

function platformOrder(p: Platform): number {
  if (p === 'windows') return 0;
  if (p === 'macos-arm') return 1;
  if (p === 'macos-intel') return 2;
  return 3;
}

interface Grouped {
  platform: Platform;
  label: string;
  primary: GitHubAsset;
  extras: GitHubAsset[];
}

function groupAssets(assets: GitHubAsset[]): Grouped[] {
  const map = new Map<Platform, Grouped>();
  for (const asset of assets) {
    const { platform, label } = detectPlatform(asset.name);
    const existing = map.get(platform);
    if (!existing) {
      map.set(platform, { platform, label, primary: asset, extras: [] });
    } else {
      existing.extras.push(asset);
    }
  }
  return Array.from(map.values()).sort((a, b) => platformOrder(a.platform) - platformOrder(b.platform));
}

export default function DownloadPage() {
  const [release, setRelease] = useState<GitHubRelease | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('https://api.github.com/repos/jash90/taskforge/releases/latest')
      .then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then((data: GitHubRelease) => setRelease(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

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
          <>
            <p className="download-hero-version">
              Najnowsza wersja: <strong>{release.name || release.tag_name}</strong>
              <span className="text-muted ml-2">({formatDate(release.published_at)})</span>
            </p>
          </>
        )}
      </header>

      {release && (
        <div className="download-platforms">
          {groupAssets(release.assets).map((g) => (
            <div key={g.platform} className="download-platform-card card">
              <div className="download-platform-icon">{platformIcon(g.platform)}</div>
              <div className="download-platform-body">
                <h3 className="download-platform-label">{g.label}</h3>
                <a href={g.primary.browser_download_url} className="btn btn-primary btn-sm download-btn" download>
                  <Download size={14} />
                  {g.primary.name}
                  <span className="download-btn-size">{formatBytes(g.primary.size)}</span>
                </a>
                {g.extras.length > 0 && (
                  <div className="download-extras">
                    {g.extras.map((a) => (
                      <a key={a.name} href={a.browser_download_url} className="download-extra-link" download>
                        {a.name} <span className="text-faint">({formatBytes(a.size)})</span>
                      </a>
                    ))}
                  </div>
                )}
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
