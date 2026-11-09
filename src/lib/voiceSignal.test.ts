import { describe, expect, it } from 'vitest';
import { BAND_COUNT, fillVoiceBands, formatLevelDb, routeFromLevels } from './voiceSignal';

describe('routeFromLevels', () => {
  it('uses the only channel with signal', () => {
    expect(routeFromLevels(0.1, 0)).toBe('left');
    expect(routeFromLevels(0, 0.1)).toBe('right');
  });
  it('detects a dead channel from room noise alone', () => {
    expect(routeFromLevels(0.00005, 0)).toBe('left');
  });
  it('mixes channels of similar level', () => {
    expect(routeFromLevels(0.1, 0.1)).toBe('both');
    expect(routeFromLevels(0.1, 0.05)).toBe('both');
  });
  it('ignores a channel far quieter than the other', () => {
    expect(routeFromLevels(0.1, 0.005)).toBe('left');
    expect(routeFromLevels(0.005, 0.1)).toBe('right');
  });
  it('makes no decision without signal', () => {
    expect(routeFromLevels(0, 0)).toBeNull();
    expect(routeFromLevels(0.0001, 0.00005)).toBeNull();
  });
});

describe('fillVoiceBands', () => {
  const run = (bins: Uint8Array) => {
    const out = new Float32Array(BAND_COUNT);
    fillVoiceBands(bins, 48000, out);
    return out;
  };
  it('places a low tone in the low bands and a high tone in the high bands', () => {
    const low = new Uint8Array(1024);
    low[Math.round(200 / (24000 / 1024))] = 255;
    const high = new Uint8Array(1024);
    high[Math.round(5000 / (24000 / 1024))] = 255;
    expect(run(low).findIndex((v) => v === 1)).toBeLessThan(10);
    expect(run(high).findIndex((v) => v === 1)).toBeGreaterThan(28);
  });
  it('normalises to 0–1 and fills every band from a flat spectrum', () => {
    const result = run(new Uint8Array(1024).fill(128));
    expect(Array.from(result).every((v) => Math.abs(v - 128 / 255) < 1e-6)).toBe(true);
  });
});

describe('formatLevelDb', () => {
  it('formats meter positions in dB', () => {
    expect(formatLevelDb(1)).toBe('0');
    expect(formatLevelDb(0.7)).toBe('−18');
    expect(formatLevelDb(0)).toBe('—');
  });
});
