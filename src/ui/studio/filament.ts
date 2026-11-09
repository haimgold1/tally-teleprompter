import { BAND_COUNT } from '../../lib/voiceSignal';

type Rgb = readonly [number, number, number];

const STEEL: Rgb = [150, 176, 214];
const AMBER: Rgb = [255, 170, 48];
const GOLD: Rgb = [255, 214, 140];
const HOT: Rgb = [255, 243, 224];
const WHITE: Rgb = [255, 255, 255];

const FRAME_MS = 32; // about 30 fps, to leave the phone's power for the video encoder
const MAX_DPR = 2;
const POINTS = 120;
const THREADS = 16;
const SMOOTH_PASSES = 3;
const IGNITE_MS = 800;
const MAX_EMBERS = 36;
const SCALE_DB = [-48, -36, -24, -18, -12, -6, -3, 0];
const ZONE_DB = [-18, -6] as const;

interface Ember {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  span: number;
}

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgba = (c: Rgb, alpha: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;

/**
 * The voice ribbon: a twisting band of light threads on the edge of the
 * prompter panel. Its outline is the real spectrum of the voice (low
 * frequencies at the center, high at the tips) and two mirrored orbs show the
 * level against a scale. Steel at rest, it ignites amber when recording starts
 * and burns white if the sound is too hot. Drawn on a DOM canvas, so it never
 * reaches the recording.
 */
export class FilamentRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly observer: ResizeObserver;
  private readonly target = new Float32Array(BAND_COUNT);
  private readonly bands = new Float32Array(BAND_COUNT);
  private readonly amp = new Float32Array(POINTS + 1);
  private readonly scratch = new Float32Array(POINTS + 1);
  private readonly embers: Ember[] = [];
  private width = 0;
  private height = 0;
  private dpr = 1;
  private raf = 0;
  private lastDraw = 0;
  private levelTarget = 0;
  private level = 0;
  private peak = 0;
  private clipping = false;
  private heat = 0;
  private live = false;
  private ignition = 0;
  private ignitedAt = -Infinity;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly readBands: (out: Float32Array) => boolean,
    private readonly reducedMotion: boolean,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    this.raf = requestAnimationFrame(this.frame);
  }

  setLevel(level: number, clipping: boolean): void {
    this.levelTarget = level;
    this.clipping = clipping;
  }

  setLive(live: boolean): void {
    if (live && !this.live) this.ignitedAt = performance.now();
    this.live = live;
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.observer.disconnect();
  }

  private resize(): void {
    const box = this.canvas.getBoundingClientRect();
    this.width = box.width;
    this.height = box.height;
    this.dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(box.width * this.dpr);
    this.canvas.height = Math.round(box.height * this.dpr);
  }

  private readonly frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const elapsed = now - this.lastDraw;
    if (elapsed < FRAME_MS || !this.width) return;
    this.lastDraw = now;
    const dt = Math.min(100, elapsed) / 1000;
    this.advance(dt);
    this.draw(now, dt);
  };

  private advance(dt: number): void {
    const hasMic = this.readBands(this.target);
    for (let i = 0; i < BAND_COUNT; i++) {
      const target = hasMic ? this.target[i] : 0;
      this.bands[i] += (target - this.bands[i]) * (target > this.bands[i] ? 0.5 : 0.16);
    }
    this.level += (this.levelTarget - this.level) * (this.levelTarget > this.level ? 0.55 : 0.14);
    this.peak = Math.max(this.level, this.peak - dt * 0.14);
    this.ignition += ((this.live ? 1 : 0) - this.ignition) * Math.min(1, dt * 5);
    this.heat += ((this.clipping ? 1 : 0) - this.heat) * Math.min(1, dt * 9);

    const reach = this.height * 0.44;
    const loudness = 0.3 + 0.7 * Math.sqrt(this.level);
    for (let i = 0; i <= POINTS; i++) {
      const u = Math.abs((2 * i) / POINTS - 1);
      const position = u * (BAND_COUNT - 1);
      const low = Math.floor(position);
      const high = Math.min(BAND_COUNT - 1, low + 1);
      this.amp[i] = this.bands[low] + (this.bands[high] - this.bands[low]) * (position - low);
    }

    // Blurring the outline is what turns a jagged spectrum into a silky shape.
    for (let pass = 0; pass < SMOOTH_PASSES; pass++) {
      this.scratch.set(this.amp);
      for (let i = 3; i <= POINTS - 3; i++) {
        this.amp[i] = (this.scratch[i - 3] + this.scratch[i - 2] + this.scratch[i - 1] + this.scratch[i] + this.scratch[i + 1] + this.scratch[i + 2] + this.scratch[i + 3]) / 7;
      }
    }

    for (let i = 0; i <= POINTS; i++) {
      const u = Math.abs((2 * i) / POINTS - 1);
      const taper = (1 - u * u) ** 1.35;
      this.amp[i] = reach * taper * (0.025 + 0.975 * Math.min(1, this.amp[i] * 1.5) ** 1.15) * loudness;
    }
  }

  /** Horizontal distance from the center for a meter position (0–1). */
  private meterOffset(position: number): number {
    return (this.width / 2) * 0.94 * position;
  }

  private ribbonY(index: number, thread: number, time: number): number {
    const x = index / POINTS;
    const a = Math.sin(x * Math.PI * 2 * 1.35 + time * 1.5 + thread * 2.4);
    const b = Math.sin(x * Math.PI * 2 * 2.85 - time * 2.1 + thread * 3.6);
    return this.height / 2 + this.amp[index] * (0.62 * a + 0.38 * b) * (0.5 + 0.5 * thread);
  }

  private orb(x: number, y: number, radius: number, color: Rgb, alpha: number): void {
    const { ctx } = this;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, rgba(color, alpha));
    glow.addColorStop(0.35, rgba(color, alpha * 0.3));
    glow.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  private draw(now: number, dt: number): void {
    const { ctx, width, height, dpr, amp, ignition, heat } = this;
    const time = this.reducedMotion ? 0 : now / 1000;
    const cx = width / 2;
    const cy = height / 2;
    const color = mix(mix(STEEL, AMBER, ignition), WHITE, heat);
    const shine = mix(mix(STEEL, GOLD, ignition), WHITE, heat);
    const core = mix(mix(STEEL, HOT, 0.5 + 0.5 * ignition), WHITE, heat);
    const presence = 0.45 + 0.55 * Math.min(1, this.level * 1.3);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'lighter';

    this.drawBloom(cx, cy, color);

    const across = (stop: Rgb, alpha: number): CanvasGradient => {
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, rgba(stop, 0));
      gradient.addColorStop(0.14, rgba(stop, alpha * 0.45));
      gradient.addColorStop(0.5, rgba(stop, alpha));
      gradient.addColorStop(0.86, rgba(stop, alpha * 0.45));
      gradient.addColorStop(1, rgba(stop, 0));
      return gradient;
    };

    // Volume: the space the voice occupies, as a soft vertical haze.
    const haze = ctx.createLinearGradient(0, 0, 0, height);
    haze.addColorStop(0.08, rgba(color, 0));
    haze.addColorStop(0.5, rgba(color, 0.11 + 0.1 * ignition));
    haze.addColorStop(0.92, rgba(color, 0));
    ctx.fillStyle = haze;
    ctx.beginPath();
    for (let i = 0; i <= POINTS; i++) ctx.lineTo((i / POINTS) * width, cy - amp[i]);
    for (let i = POINTS; i >= 0; i--) ctx.lineTo((i / POINTS) * width, cy + amp[i]);
    ctx.closePath();
    ctx.fill();

    this.drawScale(cx, cy, color, ignition);

    // The silk: many fine threads whose phases drift apart, so the band appears to twist.
    ctx.lineJoin = 'round';
    ctx.lineWidth = 0.8;
    for (let t = 0; t < THREADS; t++) {
      const thread = t / (THREADS - 1);
      ctx.strokeStyle = across(mix(color, shine, thread), (0.2 + 0.42 * thread) * presence);
      ctx.beginPath();
      for (let i = 0; i <= POINTS; i++) ctx.lineTo((i / POINTS) * width, this.ribbonY(i, thread, time));
      ctx.stroke();
    }

    // The bright edge of the ribbon, with two wide passes standing in for a blur.
    const edge = new Path2D();
    for (let i = 0; i <= POINTS; i++) edge.lineTo((i / POINTS) * width, this.ribbonY(i, 1, time));
    ctx.strokeStyle = across(color, 0.1 * presence);
    ctx.lineWidth = 12;
    ctx.stroke(edge);
    ctx.strokeStyle = across(shine, 0.24 * presence);
    ctx.lineWidth = 4;
    ctx.stroke(edge);
    ctx.strokeStyle = across(core, 0.95 * presence);
    ctx.lineWidth = 1.4;
    ctx.stroke(edge);

    // The spine, breathing slowly when nothing is being said.
    const breath = this.reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(time * 1.1);
    ctx.strokeStyle = across(core, 0.36 + 0.22 * breath + 0.26 * ignition);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(width, cy);
    ctx.stroke();

    this.drawEmbers(dt, cx, cy, shine);

    // Level orbs, mirrored from the center, each with a slowly falling peak spark.
    for (const side of [-1, 1]) {
      const x = cx + side * this.meterOffset(this.level);
      this.orb(x, cy, 26, color, 0.55);
      this.orb(x, cy, 7, core, 1);
      this.orb(cx + side * this.meterOffset(this.peak), cy, 5, shine, 0.9);
    }

    this.drawIgnition(now, cx, cy);
    ctx.globalCompositeOperation = 'source-over';
  }

  /** Light that spills from the voice onto the panel and the picture. */
  private drawBloom(cx: number, cy: number, color: Rgb): void {
    const { ctx, width, height } = this;
    const strength = (0.1 + 0.26 * this.ignition) * Math.min(1, this.level * 1.2);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, (height * 0.5) / (width * 0.42));
    const bloom = ctx.createRadialGradient(0, 0, 0, 0, 0, width * 0.42);
    bloom.addColorStop(0, rgba(color, strength));
    bloom.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = bloom;
    ctx.fillRect(-width / 2, -width / 2, width, width);
    ctx.restore();
  }

  private drawScale(cx: number, cy: number, color: Rgb, ignition: number): void {
    const { ctx } = this;
    const offsetFor = (db: number) => this.meterOffset(1 + db / 60);
    const inZone = this.level >= 1 + ZONE_DB[0] / 60 && this.level <= 1 + ZONE_DB[1] / 60;
    ctx.fillStyle = rgba(STEEL, 0.42);
    for (const db of SCALE_DB) {
      const major = db === ZONE_DB[0] || db === ZONE_DB[1] || db === 0;
      const size = major ? 5 : 2.5;
      for (const side of [-1, 1]) ctx.fillRect(cx + side * offsetFor(db) - 0.5, cy - size, 1, size * 2);
    }

    // The zone a voice should sit in, which lights up when it is there.
    ctx.strokeStyle = rgba(color, 0.18 + 0.12 * ignition + (inZone ? 0.45 : 0));
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const side of [-1, 1]) {
      ctx.moveTo(cx + side * offsetFor(ZONE_DB[0]), cy);
      ctx.lineTo(cx + side * offsetFor(ZONE_DB[1]), cy);
    }
    ctx.stroke();
  }

  /** Sparks thrown off the ribbon while recording, more of them the louder the voice. */
  private drawEmbers(dt: number, cx: number, cy: number, color: Rgb): void {
    const { embers, width } = this;
    if (this.reducedMotion) return;

    const rate = this.live ? this.level ** 2 * 34 : 0;
    if (embers.length < MAX_EMBERS && Math.random() < rate * dt) {
      const span = (Math.random() - 0.5) * width * 0.72;
      const up = Math.random() < 0.5 ? -1 : 1;
      embers.push({ x: cx + span, y: cy, vx: span * 0.12, vy: up * (18 + Math.random() * 46), life: 1, span: 0.5 + Math.random() * 0.7 });
    }

    for (let i = embers.length - 1; i >= 0; i--) {
      const ember = embers[i];
      ember.life -= dt / ember.span;
      if (ember.life <= 0) {
        embers.splice(i, 1);
        continue;
      }
      ember.x += ember.vx * dt;
      ember.y += ember.vy * dt;
      this.orb(ember.x, ember.y, 4, color, ember.life * 0.9);
    }
  }

  /** A pulse of light that runs from the center to both edges when recording begins. */
  private drawIgnition(now: number, cx: number, cy: number): void {
    if (this.reducedMotion) return;
    const progress = (now - this.ignitedAt) / IGNITE_MS;
    if (progress < 0 || progress >= 1) return;
    const { ctx, width } = this;
    const eased = 1 - (1 - progress) ** 3;
    const fade = 1 - progress;
    for (const side of [-1, 1]) {
      const head = cx + side * eased * (width / 2 + 90);
      const tail = head - side * 190;
      const streak = ctx.createLinearGradient(tail, 0, head, 0);
      streak.addColorStop(0, rgba(AMBER, 0));
      streak.addColorStop(1, rgba(HOT, fade));
      ctx.fillStyle = streak;
      ctx.fillRect(Math.min(tail, head), cy - 1.5, 190, 3);
      this.orb(head, cy, 58, AMBER, 0.7 * fade);
      this.orb(head, cy, 12, HOT, fade);
    }
  }
}
