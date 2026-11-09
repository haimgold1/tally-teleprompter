/**
 * Preference order. MP4 first because it goes straight to Photos on iPhone;
 * the codec variants exist because browsers accept different spellings of the
 * same thing. WebM is the fallback for Chrome versions without an MP4 muxer.
 */
export const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1,mp4a',
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4;codecs=avc1.640028,mp4a.40.2',
  'video/mp4;codecs=avc1.4d0028,mp4a.40.2',
  'video/mp4;codecs=avc1.42e01f,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
] as const;

export function pickMimeType(isSupported: (mime: string) => boolean): string | null {
  return MIME_CANDIDATES.find((mime) => isSupported(mime)) ?? null;
}

/** `video/mp4;codecs=…` → `video/mp4`. navigator.canShare rejects codec parameters. */
export function baseMime(mime: string): string {
  return mime.split(';')[0].trim() || 'video/mp4';
}

export function fileExtension(mime: string): 'mp4' | 'webm' {
  return baseMime(mime) === 'video/webm' ? 'webm' : 'mp4';
}
