export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

export function formatReadTime(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} sec`;
  return `${Math.round(seconds / 60)} min`;
}

export function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: 'numeric' }).format(timestamp);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 ** 3) return `${Math.round(bytes / 1024 / 1024)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

/** script-title_take-N_YYYY-MM-DD.ext, safe on every file system. */
export function takeFilename(title: string, takeNumber: number, date: Date, extension: string): string {
  const safe =
    title
      .replace(/[‎‏‪-‮⁦-⁩]/g, '')
      .replace(/[\\/:*?"<>|#%&{}$!'`@+=^~[\];,]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/\.+$/, '')
      .slice(0, 60) || 'script';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${safe}_take-${takeNumber}_${y}-${m}-${d}.${extension}`;
}
