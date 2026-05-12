import { useEffect, useState } from 'react';
import { Download, Monitor, Smartphone, Apple, Loader2, AlertCircle, ChevronDown, ChevronUp, Globe } from 'lucide-react';

interface GitHubAsset {
  name: string;
  size: number;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  prerelease: boolean;
  draft: boolean;
  html_url: string;
  assets: GitHubAsset[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Detect platform from asset filename */
type Platform = 'windows' | 'macos-intel' | 'macos-arm' | 'linux' | 'unknown';

function detectPlatform(name: string): { platform: Platform; label: string } {
  const lower = name.toLowerCase();
  if (lower.endsWith('.exe') || lower.endsWith('.msi'))
    return { platform: 'windows', label: 'Windows' };
  if (lower.includes('aarch64') && (lower.endsWith('.dmg') || lower.includes('.app.tar')))
    return { platform: 'macos-arm', label: 'macOS (Apple Silicon)' };
  if ((lower.includes('_x64') || lower.includes('x64')) && (lower.endsWith('.dmg') || lower.includes('.app.tar')))
    return { platform: 'macos-intel', label: 'macOS (Intel)' };
  if (lower.endsWith('.dmg') || lower.includes('.app.tar'))
    return { platform: 'macos-arm', label: 'macOS' };
  if (lower.endsWith('.appimage'))
    return { platform: 'linux', label: 'Linux (AppImage)' };
  if (lower.endsWith('.deb'))
    return { platform: 'linux', label: 'Linux (DEB)' };
  if (lower.endsWith('.rpm'))
    return { platform: 'linux', label: 'Linux (RPM)' };
  if (lower.endsWith('.zip') && lower.includes('portable'))
    return { platform: 'windows', label: 'Windows (portable)' };
  return { platform: 'unknown', label: 'Inna' };
}

function platformIcon(platform: Platform) {
  switch (platform) {
    case 'windows': return <Monitor size={18} />;
    case 'macos-intel': case 'macos-arm': return <Apple size={18} />;
    case 'linux': return <Monitor size={18} />;
    default: return <Globe size={18} />;
  }
}

function platformOrder(platform: Platform): number {
  switch (platform) {
    case 'windows': return 0;
    case 'macos-arm': return 1;
    case 'macos-intel': return 2;
    case 'linux': return 3;
    default: return 4;
  }
}

interface GroupedAsset {
  platform: Platform;
  label: string;
  assets: (GitHubAsset & { platformLabel: string })[];
}

function groupAssets(assets: GitHubAsset[]): GroupedAsset[] {
  const map = new Map<Platform, GroupedAsset>();
  for (const asset of assets) {
    const { platform, label } = detectPlatform(asset.name);
    if (!map.has(platform)) {
      map.set(platform, { platform, label, assets: [] });
    }
    map.get(platform)!.assets.push({ ...asset, platformLabel: label });
  }
  return Array.from(map.values()).sort((a, b) => platformOrder(a.platform) - platformOrder(b.platform));
}

function AssetGroup({ group }: { group: GroupedAsset }) {
  const [expanded, setExpanded] = useState(group.assets.length <= 2);
  const visible = expanded ? group.assets : group.assets.slice(0, 2);
  const hidden = group.assets.length - visible.length;

  return (
    <div className="download-platform-group">
      <div className="download-platform-header">
        {platformIcon(group.platform)}
        <span className="font-semibold">{group.label}</span>
      </div>
      <ul className="download-asset-list">
        {visible.map((asset) => (
          <li key={asset.name}>
            <a
              href={asset.browser_download_url}
              className="download-asset-link"
              download
            >
              <Download size={16} />
              <span className="download-asset-name">{asset.name}</span>
              <span className="download-asset-size">{formatBytes(asset.size)}</span>
            </a>
          </li>
        ))}
      </ul>
      {!expanded && hidden > 0 && (
        <button
          type="button"
          className="btn btn-ghost btn-sm mt-2"
          onClick={() => setExpanded(true)}
        >
          <ChevronDown size={14} /> Pokaż {hidden} więcej
        </button>
      )}
      {expanded && group.assets.length > 2 && (
        <button
          type="button"
          className="btn btn-ghost btn-sm mt-2"
          onClick={() => setExpanded(false)}
        >
          <ChevronUp size={14} /> Zwiń
        </button>
      )}
    </div>
  );
}

function ReleaseCard({ release }: { release: GitHubRelease }) {
  const [expanded, setExpanded] = useState(false);
  const grouped = groupAssets(release.assets);
  const isLatest = !release.prerelease && !release.draft;

  return (
    <div className={`card download-release-card ${isLatest ? 'download-release-latest' : ''}`}>
      <div className="download-release-header">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="card-title mb-0">{release.name || release.tag_name}</h3>
            {isLatest && <span className="badge badge-accent">Najnowsza</span>}
            {release.prerelease && <span className="badge badge-warning">Wersja przedpremierowa</span>}
          </div>
          <p className="text-sm text-muted mt-1">
            Opublikowana {formatDate(release.published_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={release.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-sm"
          >
            GitHub
          </a>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Zwiń' : 'Pobierz'}
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="download-release-assets">
          {grouped.map((group) => (
            <AssetGroup key={group.platform} group={group} />
          ))}
          {grouped.length === 0 && (
            <p className="text-muted text-sm">Brak plików do pobrania w tej wersji.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function DownloadPage() {
  const [releases, setReleases] = useState<GitHubRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const repo = 'jash90/taskforge';
    fetch(`https://api.github.com/repos/${repo}/releases?per_page=10`)
      .then((res) => {
        if (!res.ok) throw new Error(`GitHub API: ${res.status}`);
        return res.json();
      })
      .then((data: GitHubRelease[]) => {
        // Filter out drafts (they're not publicly visible anyway)
        const publicReleases = data.filter((r) => !r.draft);
        setReleases(publicReleases);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="download-page">
      <header className="download-hero">
        <div className="download-hero-icon">
          <Download size={32} />
        </div>
        <h1 className="download-hero-title">Pobierz TaskForge</h1>
        <p className="download-hero-subtitle">
          Dostępne wersje na Windows, macOS i Linux.
          Pliki instalacyjne pochodzą z oficjalnych wydań na GitHub.
        </p>
      </header>

      {loading && (
        <div className="empty-state">
          <Loader2 size={32} className="animate-spin text-muted" />
          <p className="text-muted mt-4">Ładowanie wydań…</p>
        </div>
      )}

      {error && (
        <div className="card download-error-card">
          <AlertCircle size={20} className="text-danger" />
          <div>
            <p className="font-semibold text-danger">Nie udało się załadować wydań</p>
            <p className="text-sm text-muted">{error}</p>
          </div>
          <a
            href="https://github.com/jash90/taskforge/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline btn-sm ml-auto"
          >
            Otwórz na GitHub
          </a>
        </div>
      )}

      {!loading && !error && releases.length === 0 && (
        <div className="empty-state">
          <Smartphone size={32} className="text-muted" />
          <p className="text-muted mt-4">Brak dostępnych wydań.</p>
          <a
            href="https://github.com/jash90/taskforge/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline mt-4"
          >
            Sprawdź na GitHub
          </a>
        </div>
      )}

      <div className="download-releases-list">
        {releases.map((release) => (
          <ReleaseCard key={release.tag_name} release={release} />
        ))}
      </div>

      <footer className="download-footer">
        <p className="text-sm text-muted">
          Wszystkie pliki pochodzą z&nbsp;
          <a
            href="https://github.com/jash90/taskforge/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent"
          >
            github.com/jash90/taskforge/releases
          </a>
        </p>
      </footer>
    </div>
  );
}
