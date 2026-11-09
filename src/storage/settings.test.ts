import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, sanitizeSettings } from './settings';

describe('sanitizeSettings', () => {
  it('returns defaults for junk', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('x')).toEqual(DEFAULT_SETTINGS);
  });
  it('clamps out-of-range values', () => {
    const result = sanitizeSettings({ wpm: 9000, fontSize: 1, panelOpacity: 400 });
    expect(result.wpm).toBe(300);
    expect(result.fontSize).toBe(20);
    expect(result.panelOpacity).toBe(100);
  });
  it('keeps valid values and rejects wrong types', () => {
    const result = sanitizeSettings({ wpm: 180, mirrorText: true, grid: 'yes', aspect: '16:9' });
    expect(result).toMatchObject({ wpm: 180, mirrorText: true, grid: false, aspect: '16:9' });
  });
});
