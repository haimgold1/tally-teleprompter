export interface LevelReading {
  /** Meter position, 0–1, on a -60…0 dB scale. */
  level: number;
  clipping: boolean;
  silent: boolean;
}

const CLIP_PEAK = 0.985;
const CLIP_HOLD_MS = 1500;
const SILENCE_RMS_DB = -58;
const SILENCE_AFTER_MS = 3000;
const METER_FLOOR_DB = -60;

export const toDb = (linear: number): number => (linear > 0 ? 20 * Math.log10(linear) : -Infinity);

/** Turns raw peak/RMS samples into a meter position and held warning states. */
export class LevelMonitor {
  private lastClip = -Infinity;
  private soundAt: number | null = null;

  update(peak: number, rms: number, now: number): LevelReading {
    if (peak >= CLIP_PEAK) this.lastClip = now;
    if (this.soundAt === null || toDb(rms) > SILENCE_RMS_DB) this.soundAt = now;
    const level = Math.min(1, Math.max(0, (toDb(peak) - METER_FLOOR_DB) / -METER_FLOOR_DB));
    return {
      level,
      clipping: now - this.lastClip < CLIP_HOLD_MS,
      silent: now - this.soundAt >= SILENCE_AFTER_MS,
    };
  }

  reset(): void {
    this.lastClip = -Infinity;
    this.soundAt = null;
  }
}
