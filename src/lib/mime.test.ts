import { describe, expect, it } from 'vitest';
import { baseMime, fileExtension, MIME_CANDIDATES, pickMimeType } from './mime';

const only = (...supported: string[]) => (mime: string) => supported.includes(mime);

describe('pickMimeType', () => {
  it('prefers the exact avc1/mp4a type when available', () => {
    expect(pickMimeType(() => true)).toBe('video/mp4;codecs=avc1,mp4a');
  });
  it('iOS Safari: uses an explicit H.264/AAC profile', () => {
    expect(pickMimeType(only('video/mp4', 'video/mp4;codecs=avc1.42e01f,mp4a.40.2'))).toBe(
      'video/mp4;codecs=avc1.42e01f,mp4a.40.2',
    );
  });
  it('older iOS Safari: falls back to bare video/mp4', () => {
    expect(pickMimeType(only('video/mp4'))).toBe('video/mp4');
  });
  it('newer Chrome: picks MP4 over WebM', () => {
    expect(
      pickMimeType(only('video/mp4;codecs=avc1,mp4a.40.2', 'video/webm;codecs=vp9,opus', 'video/webm')),
    ).toBe('video/mp4;codecs=avc1,mp4a.40.2');
  });
  it('older Chrome: WebM VP9', () => {
    expect(pickMimeType(only('video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus'))).toBe(
      'video/webm;codecs=vp9,opus',
    );
  });
  it('no VP9: WebM VP8', () => {
    expect(pickMimeType(only('video/webm;codecs=vp8,opus', 'video/webm'))).toBe('video/webm;codecs=vp8,opus');
  });
  it('returns null when nothing is supported', () => {
    expect(pickMimeType(() => false)).toBeNull();
  });
  it('tries every MP4 before any WebM', () => {
    const lastMp4 = MIME_CANDIDATES.map((m) => m.startsWith('video/mp4')).lastIndexOf(true);
    const firstWebm = MIME_CANDIDATES.findIndex((m) => m.startsWith('video/webm'));
    expect(lastMp4).toBeLessThan(firstWebm);
  });
});

describe('baseMime and fileExtension', () => {
  it('strips codecs', () => {
    expect(baseMime('video/mp4;codecs=avc1,mp4a')).toBe('video/mp4');
    expect(baseMime('video/webm; codecs="vp9,opus"')).toBe('video/webm');
  });
  it('maps to the real extension', () => {
    expect(fileExtension('video/mp4;codecs=avc1')).toBe('mp4');
    expect(fileExtension('video/webm;codecs=vp9,opus')).toBe('webm');
  });
});
