import { LevelMonitor, type LevelReading } from '../lib/levels';
import { fillVoiceBands, ROUTE_GAINS, routeFromLevels, type InputRoute } from '../lib/voiceSignal';

/** 15 Hz is smooth enough for level logic and much lighter than a per-frame loop. */
const POLL_MS = 66;
/** Consecutive agreeing polls before the input route changes, so it cannot flutter. */
const ROUTE_CONFIRM_POLLS = 4;
const ROUTE_GLIDE_SECONDS = 0.03;
const RESUME_TIMEOUT_MS = 400;

function rms(samples: Float32Array): number {
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / samples.length);
}

/**
 * The voice path from microphone to recorder:
 *
 *   mic → pick the live channel(s) → mono → rumble filter → EQ → compressor → limiter → both ears
 *
 * A phone has one usable voice mic, so the output is the same signal in the
 * left and right ears, which is what puts a voice in the center of headphones.
 * The meter reads before processing, so it shows what the mic really hears.
 */
export class VoiceChain {
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private output: MediaStreamAudioDestinationNode | null = null;
  private meter: AnalyserNode | null = null;
  private bins: Uint8Array<ArrayBuffer> = new Uint8Array(0);
  private timer = 0;
  private route: InputRoute = 'both';
  private pendingRoute: InputRoute | null = null;
  private pendingPolls = 0;
  private readonly monitor = new LevelMonitor();

  constructor(private readonly onReading: (reading: LevelReading) => void) {}

  start(stream: MediaStream): void {
    this.stop();
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Context || stream.getAudioTracks().length === 0) return;

    const context = new Context();
    const source = context.createMediaStreamSource(stream);
    const splitter = context.createChannelSplitter(2);
    source.connect(splitter);

    const [leftProbe, rightProbe] = [0, 1].map((channel) => {
      const probe = context.createAnalyser();
      probe.fftSize = 1024;
      splitter.connect(probe, channel);
      return probe;
    });

    const leftGain = context.createGain();
    const rightGain = context.createGain();
    splitter.connect(leftGain, 0);
    splitter.connect(rightGain, 1);

    const mono = context.createGain();
    mono.channelCount = 1;
    mono.channelCountMode = 'explicit';
    mono.channelInterpretation = 'speakers';
    leftGain.connect(mono);
    rightGain.connect(mono);
    this.route = 'both';
    this.applyRoute(leftGain, rightGain, context, 0);

    const meter = context.createAnalyser();
    meter.fftSize = 2048;
    meter.smoothingTimeConstant = 0.55;
    meter.minDecibels = -85;
    meter.maxDecibels = -20;
    mono.connect(meter); // Never connected to the speakers, so there is no feedback.

    const output = context.createMediaStreamDestination();
    output.channelCount = 2;
    output.channelCountMode = 'explicit';
    output.channelInterpretation = 'speakers';
    this.buildVoiceFilters(context, mono).connect(output);

    this.context = context;
    this.source = source;
    this.output = output;
    this.meter = meter;
    this.bins = new Uint8Array(meter.frequencyBinCount);
    this.monitor.reset();
    void this.resume();

    const leftSamples = new Float32Array(leftProbe.fftSize);
    const rightSamples = new Float32Array(rightProbe.fftSize);
    const samples = new Float32Array(meter.fftSize);
    this.timer = window.setInterval(() => {
      leftProbe.getFloatTimeDomainData(leftSamples);
      rightProbe.getFloatTimeDomainData(rightSamples);
      this.updateRoute(routeFromLevels(rms(leftSamples), rms(rightSamples)), leftGain, rightGain, context);

      meter.getFloatTimeDomainData(samples);
      let peak = 0;
      for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
      this.onReading(this.monitor.update(peak, rms(samples), performance.now()));
    }, POLL_MS);
  }

  /** Tuned for speech on a phone mic; every stage is gentle so the voice stays natural. */
  private buildVoiceFilters(context: AudioContext, input: AudioNode): AudioNode {
    const biquad = (type: BiquadFilterType, frequency: number, Q: number, gain = 0) => {
      const filter = context.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = frequency;
      filter.Q.value = Q;
      filter.gain.value = gain;
      return filter;
    };
    const dynamics = (threshold: number, knee: number, ratio: number, attack: number, release: number) => {
      const node = context.createDynamicsCompressor();
      node.threshold.value = threshold;
      node.knee.value = knee;
      node.ratio.value = ratio;
      node.attack.value = attack;
      node.release.value = release;
      return node;
    };

    const stages: AudioNode[] = [
      biquad('highpass', 85, 0.707), // handling noise and room rumble
      biquad('peaking', 280, 1, -2), // boxiness of a small mic
      biquad('peaking', 3200, 0.9, 2.5), // clarity of consonants
      biquad('highshelf', 9500, 0.7, 2), // air
      dynamics(-22, 10, 3.2, 0.006, 0.16), // evens out loud and quiet words
      dynamics(-2.5, 0, 20, 0.001, 0.06), // catches peaks before they distort
    ];
    return stages.reduce((previous, stage) => previous.connect(stage), input);
  }

  private updateRoute(next: InputRoute | null, left: GainNode, right: GainNode, context: AudioContext): void {
    if (next === null || next === this.route) {
      this.pendingRoute = null;
      this.pendingPolls = 0;
      return;
    }
    this.pendingPolls = next === this.pendingRoute ? this.pendingPolls + 1 : 1;
    this.pendingRoute = next;
    if (this.pendingPolls < ROUTE_CONFIRM_POLLS) return;
    this.route = next;
    this.pendingRoute = null;
    this.pendingPolls = 0;
    this.applyRoute(left, right, context, ROUTE_GLIDE_SECONDS);
  }

  private applyRoute(left: GainNode, right: GainNode, context: AudioContext, glide: number): void {
    const [leftLevel, rightLevel] = ROUTE_GAINS[this.route];
    if (glide > 0) {
      left.gain.setTargetAtTime(leftLevel, context.currentTime, glide);
      right.gain.setTargetAtTime(rightLevel, context.currentTime, glide);
    } else {
      left.gain.value = leftLevel;
      right.gain.value = rightLevel;
    }
  }

  /** Copies the live voice spectrum into `out`. Returns false when no mic is running. */
  readBands(out: Float32Array): boolean {
    if (!this.meter || !this.context) return false;
    this.meter.getByteFrequencyData(this.bins);
    fillVoiceBands(this.bins, this.context.sampleRate, out);
    return true;
  }

  /** iOS keeps an AudioContext suspended until a user gesture, and after interruptions. */
  async resume(): Promise<void> {
    if (this.context && this.context.state !== 'running') await this.context.resume().catch(() => undefined);
  }

  /**
   * The track to record. A suspended context would produce silence, so in
   * that case the raw microphone is recorded instead of losing the sound.
   */
  async recordTrack(stream: MediaStream): Promise<MediaStreamTrack | undefined> {
    await Promise.race([this.resume(), new Promise((resolve) => setTimeout(resolve, RESUME_TIMEOUT_MS))]);
    const processed = this.context?.state === 'running' ? this.output?.stream.getAudioTracks()[0] : undefined;
    return processed ?? stream.getAudioTracks()[0];
  }

  stop(): void {
    clearInterval(this.timer);
    this.source?.disconnect();
    void this.context?.close().catch(() => undefined);
    this.context = null;
    this.source = null;
    this.output = null;
    this.meter = null;
  }
}
