import { LevelMonitor, type LevelReading } from '../lib/levels';

/** 15 Hz is smooth enough for a meter and much lighter than a per-frame loop. */
const POLL_MS = 66;

export class AudioMeter {
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private timer = 0;
  private readonly monitor = new LevelMonitor();

  constructor(private readonly onReading: (reading: LevelReading) => void) {}

  start(stream: MediaStream): void {
    this.stop();
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Context || stream.getAudioTracks().length === 0) return;

    const context = new Context();
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    const source = context.createMediaStreamSource(stream);
    source.connect(analyser); // Never connected to the output, so there is no feedback.
    this.context = context;
    this.source = source;
    this.monitor.reset();
    void this.resume();

    const samples = new Float32Array(analyser.fftSize);
    this.timer = window.setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      let peak = 0;
      let sum = 0;
      for (const sample of samples) {
        const magnitude = Math.abs(sample);
        if (magnitude > peak) peak = magnitude;
        sum += sample * sample;
      }
      this.onReading(this.monitor.update(peak, Math.sqrt(sum / samples.length), performance.now()));
    }, POLL_MS);
  }

  /** iOS keeps an AudioContext suspended until a user gesture, and after interruptions. */
  async resume(): Promise<void> {
    if (this.context && this.context.state !== 'running') await this.context.resume().catch(() => undefined);
  }

  stop(): void {
    clearInterval(this.timer);
    this.source?.disconnect();
    void this.context?.close().catch(() => undefined);
    this.context = null;
    this.source = null;
  }
}
