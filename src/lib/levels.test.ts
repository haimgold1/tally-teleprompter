import { describe, expect, it } from 'vitest';
import { LevelMonitor } from './levels';

describe('LevelMonitor', () => {
  it('maps peak to a -60..0 dB meter', () => {
    const monitor = new LevelMonitor();
    expect(monitor.update(1, 0.5, 0).level).toBe(1);
    expect(monitor.update(0.001, 0.0005, 10).level).toBeCloseTo(0);
    expect(monitor.update(0.1, 0.05, 20).level).toBeCloseTo(2 / 3);
  });
  it('flags clipping and holds it briefly', () => {
    const monitor = new LevelMonitor();
    expect(monitor.update(1, 0.5, 0).clipping).toBe(true);
    expect(monitor.update(0.2, 0.1, 1000).clipping).toBe(true);
    expect(monitor.update(0.2, 0.1, 1600).clipping).toBe(false);
  });
  it('flags silence only after 3 seconds', () => {
    const monitor = new LevelMonitor();
    expect(monitor.update(0, 0, 0).silent).toBe(false);
    expect(monitor.update(0, 0, 2900).silent).toBe(false);
    expect(monitor.update(0, 0, 3000).silent).toBe(true);
  });
  it('clears silence when sound returns', () => {
    const monitor = new LevelMonitor();
    monitor.update(0, 0, 0);
    expect(monitor.update(0, 0, 4000).silent).toBe(true);
    expect(monitor.update(0.3, 0.1, 4100).silent).toBe(false);
  });
});
