import { describe, expect, it } from 'vitest';
import { formatClock, takeFilename } from './format';

describe('takeFilename', () => {
  const date = new Date(2026, 10, 9);
  it('follows the required pattern', () => {
    expect(takeFilename('intro', 3, date, 'mp4')).toBe('intro_take-3_2026-11-09.mp4');
  });
  it('keeps Hebrew and replaces spaces', () => {
    expect(takeFilename('פתיחה לסרטון', 1, date, 'mp4')).toBe('פתיחה-לסרטון_take-1_2026-11-09.mp4');
  });
  it('removes characters that are illegal in file names', () => {
    expect(takeFilename('a/b:c*?"<>|', 1, date, 'webm')).toBe('abc_take-1_2026-11-09.webm');
  });
  it('has a fallback for an empty title', () => {
    expect(takeFilename('  ', 2, date, 'mp4')).toBe('script_take-2_2026-11-09.mp4');
  });
});

describe('formatClock', () => {
  it('formats minutes and hours', () => {
    expect(formatClock(5)).toBe('0:05');
    expect(formatClock(125)).toBe('2:05');
    expect(formatClock(3725)).toBe('1:02:05');
  });
  it('never shows negative time', () => {
    expect(formatClock(-4)).toBe('0:00');
  });
});
