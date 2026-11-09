export const WPM_MIN = 60;
export const WPM_MAX = 300;
export const WPM_DEFAULT = 140;

export function clampWpm(wpm: number): number {
  return Math.min(WPM_MAX, Math.max(WPM_MIN, Math.round(wpm)));
}

/** Seconds needed to read `words` at `wpm`. */
export function readSeconds(words: number, wpm: number): number {
  return words > 0 && wpm > 0 ? (words / wpm) * 60 : 0;
}

/** Scroll speed: rendered text height ÷ reading time. */
export function pxPerSecond(heightPx: number, words: number, wpm: number): number {
  const seconds = readSeconds(words, wpm);
  return seconds > 0 && heightPx > 0 ? heightPx / seconds : 0;
}

/** Seconds left to read, given the current scroll offset. */
export function remainingSeconds(offsetPx: number, heightPx: number, words: number, wpm: number): number {
  const speed = pxPerSecond(heightPx, words, wpm);
  return speed > 0 ? Math.max(0, heightPx - offsetPx) / speed : 0;
}

/** Advances a float offset by one frame, clamped to [0, max]. */
export function advanceOffset(offset: number, speed: number, dtMs: number, max: number): number {
  return Math.min(max, Math.max(0, offset + (speed * dtMs) / 1000));
}
