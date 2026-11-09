export type ExportResult = 'shared' | 'downloaded' | 'cancelled';

export function canShareFile(file: File): boolean {
  return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
}

export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Must be called synchronously from the tap, with the File already built:
 * iOS rejects navigator.share once the user activation has passed. Only
 * `files` is sent, because extra title/text fields remove "Save Video" on iOS.
 */
export async function exportFile(file: File): Promise<ExportResult> {
  if (canShareFile(file)) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (error) {
      if ((error as { name?: string }).name === 'AbortError') return 'cancelled';
    }
  }
  downloadFile(file);
  return 'downloaded';
}
