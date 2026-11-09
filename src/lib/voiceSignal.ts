import { toDb } from './levels';

export type InputRoute = 'left' | 'right' | 'both';

/** Linear gains applied to the [left, right] input channels before they are mixed to one. */
export const ROUTE_GAINS: Record<InputRoute, readonly [number, number]> = {
  left: [1, 0],
  right: [0, 1],
  both: [0.5, 0.5],
};

const DIGITAL_SILENCE = 1e-6;
const NOISE_FLOOR = 3.16e-4; // -70 dBFS
const SIDE_GAP_DB = 18;

/**
 * Decides which input channels hold the voice. Some phones deliver a stereo
 * track with one dead channel, which would otherwise play in one ear only.
 * Returns null when there is not enough signal to tell.
 */
export function routeFromLevels(rmsLeft: number, rmsRight: number): InputRoute | null {
  const louder = Math.max(rmsLeft, rmsRight);
  const quieter = Math.min(rmsLeft, rmsRight);
  if (louder < DIGITAL_SILENCE) return null;
  const side: InputRoute = rmsLeft > rmsRight ? 'left' : 'right';
  if (quieter < DIGITAL_SILENCE) return side;
  if (louder < NOISE_FLOOR) return null;
  return toDb(louder) - toDb(quieter) < SIDE_GAP_DB ? 'both' : side;
}

export const BAND_COUNT = 40;
const BAND_MIN_HZ = 90;
const BAND_MAX_HZ = 7000;

/** Reduces analyser bins to log-spaced voice bands (0–1), lowest frequency first. */
export function fillVoiceBands(bins: ArrayLike<number>, sampleRate: number, out: Float32Array): void {
  const hzPerBin = sampleRate / 2 / bins.length;
  const ratio = BAND_MAX_HZ / BAND_MIN_HZ;
  for (let band = 0; band < out.length; band++) {
    const startHz = BAND_MIN_HZ * ratio ** (band / out.length);
    const endHz = BAND_MIN_HZ * ratio ** ((band + 1) / out.length);
    const first = Math.min(bins.length - 1, Math.floor(startHz / hzPerBin));
    const last = Math.min(bins.length - 1, Math.max(first, Math.ceil(endHz / hzPerBin) - 1));
    let peak = 0;
    for (let bin = first; bin <= last; bin++) peak = Math.max(peak, bins[bin]);
    out[band] = peak / 255;
  }
}

/** Meter position (0–1 over -60…0 dB) as a whole-dB label. */
export function formatLevelDb(level: number): string {
  if (level <= 0.02) return '—';
  const db = Math.round((level - 1) * 60);
  return db < 0 ? `−${-db}` : '0';
}
