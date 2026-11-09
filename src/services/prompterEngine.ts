import { advanceOffset, clampWpm, pxPerSecond, remainingSeconds, WPM_DEFAULT } from '../lib/wpm';

export interface EngineCallbacks {
  /** Called every frame the offset changes; must only write a transform. */
  applyOffset: (offset: number) => void;
  onPlayingChange: (playing: boolean) => void;
  /** Throttled to about 4 Hz. */
  onRemaining: (seconds: number) => void;
}

const RAMP_MS = 260;
const MAX_FRAME_MS = 250;
const REMAINING_INTERVAL_MS = 250;

/**
 * Keeps scroll position in a float and advances it by real elapsed time, so
 * speed stays exact on any refresh rate. The loop only runs while playing.
 */
export class PrompterEngine {
  private callbacks: EngineCallbacks | null = null;
  private offset = 0;
  private height = 0;
  private words = 0;
  private wpm = WPM_DEFAULT;
  private playing = false;
  private frame = 0;
  private lastFrame = 0;
  private rampStart = 0;
  private lastRemaining = 0;

  bind(callbacks: EngineCallbacks | null): void {
    this.callbacks = callbacks;
    if (callbacks) this.publish(true);
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  get speed(): number {
    return pxPerSecond(this.height, this.words, this.wpm);
  }

  get isAtEnd(): boolean {
    return this.height > 0 && this.offset >= this.height;
  }

  /** Keeps the reader's place (as a fraction) when font or panel changes reflow the text. */
  setMetrics(height: number, words: number): void {
    const ratio = this.height > 0 ? this.offset / this.height : 0;
    this.height = height;
    this.words = words;
    this.offset = ratio * height;
    this.publish(true);
  }

  setWpm(wpm: number): void {
    this.wpm = clampWpm(wpm);
    this.publish(true);
  }

  play(): void {
    if (this.playing || this.speed <= 0) return;
    if (this.isAtEnd) this.offset = 0;
    this.playing = true;
    this.lastFrame = 0;
    this.rampStart = 0;
    this.callbacks?.onPlayingChange(true);
    this.frame = requestAnimationFrame(this.loop);
  }

  pause(): void {
    if (!this.playing) return;
    this.playing = false;
    cancelAnimationFrame(this.frame);
    this.callbacks?.onPlayingChange(false);
    this.publish(true);
  }

  toggle(): void {
    if (this.playing) this.pause();
    else this.play();
  }

  reset(): void {
    this.pause();
    this.offset = 0;
    this.publish(true);
  }

  jumpSeconds(seconds: number): void {
    this.moveTo(this.offset + this.speed * seconds);
  }

  scrubBy(deltaPx: number): void {
    this.moveTo(this.offset + deltaPx);
  }

  private moveTo(offset: number): void {
    this.offset = Math.min(this.height, Math.max(0, offset));
    this.publish(true);
  }

  private readonly loop = (now: number): void => {
    if (!this.playing) return;
    if (!this.lastFrame) {
      this.lastFrame = now;
      this.rampStart = now;
    }
    const dt = Math.min(MAX_FRAME_MS, now - this.lastFrame);
    this.lastFrame = now;
    const ramp = Math.min(1, (now - this.rampStart) / RAMP_MS);
    this.offset = advanceOffset(this.offset, this.speed * ramp, dt, this.height);
    this.publish(false);
    if (this.isAtEnd) {
      this.pause();
      return;
    }
    this.frame = requestAnimationFrame(this.loop);
  };

  private publish(forceRemaining: boolean): void {
    this.callbacks?.applyOffset(this.offset);
    const now = performance.now();
    if (forceRemaining || now - this.lastRemaining >= REMAINING_INTERVAL_MS) {
      this.lastRemaining = now;
      this.callbacks?.onRemaining(remainingSeconds(this.offset, this.height, this.words, this.wpm));
    }
  }
}
