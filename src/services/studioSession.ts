import { classifyCameraError, isQuotaError, type AppErrorKind } from '../lib/errors';
import type { LevelReading } from '../lib/levels';
import { decidePipeline, type Aspect } from '../lib/pipeline';
import { isIOS, wakeLockIsReliable } from '../lib/platform';
import { createTake, deleteTake, storageUsage, TakeWriter, updateTake, type Take } from '../storage/takes';
import { AudioMeter } from './audioMeter';
import { attachPreview, cameraSupport, openCamera, stopStream } from './camera';
import { grabThumbnail, supportedMimeType, TakeRecorder } from './recorder';
import { ScreenAwake } from './wakeLock';

export type Phase = 'starting' | 'ready' | 'countdown' | 'recording' | 'paused' | 'saving' | 'error';

export interface SessionState {
  phase: Phase;
  countdown: number;
  error: AppErrorKind | null;
  videoWidth: number;
  videoHeight: number;
}

export interface SessionHooks {
  onState: (state: SessionState) => void;
  onLevel: (reading: LevelReading) => void;
  onNotice: (text: string) => void;
  onRecordingStarted: () => void;
  onRecordingPaused: () => void;
  onRecordingResumed: () => void;
  onFinished: (takeId: string | null) => void;
}

const COUNTDOWN_FROM = 3;
const LOW_STORAGE_BYTES = 300 * 1024 * 1024;
const THUMBNAIL_DELAY_MS = 600;

const INTERRUPTED_NOTICE = 'Recording stopped because the screen or app was interrupted. Everything so far is saved.';
const ROTATE_NOTICE = 'Avoid rotating the phone while recording';
const NO_WAKE_LOCK_NOTICE = 'To keep the screen on: Settings → Display & Brightness → Auto-Lock → Never';

/** Owns everything with a lifecycle on the recording screen; the UI only renders its state. */
export class StudioSession {
  private state: SessionState = { phase: 'starting', countdown: 0, error: null, videoWidth: 0, videoHeight: 0 };
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private recorder: TakeRecorder | null = null;
  private writer: TakeWriter | null = null;
  private take: Take | null = null;
  private countdownTimer = 0;
  private closed = false;
  private finishing = false;
  private aspect: Aspect = '9:16';
  private readonly awake = new ScreenAwake();
  private readonly meter: AudioMeter;

  constructor(
    private readonly scriptId: string,
    private readonly hooks: SessionHooks,
  ) {
    this.meter = new AudioMeter(hooks.onLevel);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  get phase(): Phase {
    return this.state.phase;
  }

  get elapsedMs(): number {
    return this.recorder?.elapsedMs ?? 0;
  }

  private update(patch: Partial<SessionState>): void {
    this.state = { ...this.state, ...patch };
    this.hooks.onState(this.state);
  }

  async open(video: HTMLVideoElement): Promise<void> {
    this.video = video;
    this.update({ phase: 'starting', error: null });

    const support = cameraSupport();
    if (support !== 'ok') {
      this.update({ phase: 'error', error: support });
      return;
    }

    try {
      const stream = await openCamera();
      if (this.closed) {
        stopStream(stream);
        return;
      }
      this.stream = stream;
      stream.getVideoTracks()[0]?.addEventListener('ended', this.onTrackEnded);
      await attachPreview(video, stream);
      if (this.closed) return;
      video.addEventListener('resize', this.onVideoResize);
      this.meter.start(stream);
      await this.awake.enable();
      if (!wakeLockIsReliable() && isIOS()) this.hooks.onNotice(NO_WAKE_LOCK_NOTICE);
      this.update({ phase: 'ready', videoWidth: video.videoWidth, videoHeight: video.videoHeight });
    } catch (error) {
      this.update({ phase: 'error', error: classifyCameraError(error) });
    }
  }

  /** Call on any touch: iOS needs a gesture to run the audio context. */
  userGesture(): void {
    void this.meter.resume();
  }

  startCountdown(aspect: Aspect): void {
    if (this.state.phase !== 'ready') return;
    this.aspect = aspect;
    void this.meter.resume();
    void navigator.storage?.persist?.().catch(() => undefined);
    this.update({ phase: 'countdown', countdown: COUNTDOWN_FROM });

    const tick = (): void => {
      const next = this.state.countdown - 1;
      if (next > 0) {
        this.update({ countdown: next });
        this.countdownTimer = window.setTimeout(tick, 1000);
      } else {
        this.update({ countdown: 0 });
        void this.beginRecording();
      }
    };
    this.countdownTimer = window.setTimeout(tick, 1000);
  }

  cancelCountdown(): void {
    if (this.state.phase !== 'countdown') return;
    clearTimeout(this.countdownTimer);
    this.update({ phase: 'ready', countdown: 0 });
  }

  private async beginRecording(): Promise<void> {
    const { video, stream } = this;
    if (!video || !stream || this.closed) return;

    try {
      const usage = await storageUsage();
      if (usage.available !== null && usage.available < LOW_STORAGE_BYTES) {
        this.hooks.onNotice('Storage is running low. Consider deleting old takes.');
      }

      const plan = decidePipeline(video.videoWidth, video.videoHeight, this.aspect);
      const take = await createTake(this.scriptId, {
        mimeType: supportedMimeType() ?? 'video/mp4',
        width: plan.outW,
        height: plan.outH,
        aspect: this.aspect,
      });
      this.take = take;
      const writer = new TakeWriter(take, this.onWriteFailure);
      this.writer = writer;

      const recorder = new TakeRecorder({
        stream,
        video,
        aspect: this.aspect,
        onChunk: (blob, elapsed) => writer.append(blob, elapsed),
        onError: () => void this.finish(INTERRUPTED_NOTICE),
      });
      this.recorder = recorder;
      await updateTake(take.id, { mimeType: recorder.mimeType });

      this.lockOrientation();
      await recorder.start();
      if (this.closed) return;
      this.update({ phase: 'recording' });
      this.hooks.onRecordingStarted();

      setTimeout(() => {
        const thumbnail = this.video && this.take?.id === take.id ? grabThumbnail(this.video, this.aspect) : undefined;
        if (thumbnail) void updateTake(take.id, { thumbnail }).catch(() => undefined);
      }, THUMBNAIL_DELAY_MS);
    } catch (error) {
      if (this.take) void deleteTake(this.take.id).catch(() => undefined);
      this.resetRecording();
      this.update({ phase: 'error', error: isQuotaError(error) ? 'storage-full' : 'unknown' });
    }
  }

  pauseRecording(): void {
    if (this.state.phase !== 'recording' || !this.recorder) return;
    this.recorder.pause();
    this.update({ phase: 'paused' });
    this.hooks.onRecordingPaused();
  }

  resumeRecording(): void {
    if (this.state.phase !== 'paused' || !this.recorder) return;
    this.recorder.resume();
    this.update({ phase: 'recording' });
    this.hooks.onRecordingResumed();
  }

  stop(): Promise<void> {
    return this.finish();
  }

  private async finish(notice?: string): Promise<void> {
    const { recorder, writer, take } = this;
    if (this.finishing || !recorder || !writer || !take) return;
    this.finishing = true;
    if (!this.closed) this.update({ phase: 'saving' });

    const durationMs = recorder.elapsedMs;
    await recorder.stop();
    this.unlockOrientation();

    let keptTakeId: string | null = take.id;
    try {
      await writer.finish({ durationMs, mimeType: recorder.mimeType });
      if (writer.bytesWritten === 0) {
        await deleteTake(take.id);
        keptTakeId = null;
      }
    } catch {
      // The chunks are committed; startup recovery will finish this take.
    }

    this.resetRecording();
    this.finishing = false;
    if (!this.closed && !keptTakeId) this.update({ phase: 'ready' });
    if (notice) this.hooks.onNotice(notice);
    this.hooks.onFinished(keptTakeId);
  }

  private resetRecording(): void {
    this.recorder = null;
    this.writer = null;
    this.take = null;
  }

  private readonly onWriteFailure = (error: unknown): void => {
    const notice = isQuotaError(error)
      ? 'Storage is full, so recording stopped. Everything so far is saved.'
      : 'Saving failed, so recording stopped. Everything so far is saved.';
    void this.finish(notice);
  };

  private readonly onTrackEnded = (): void => {
    if (this.recorder) void this.finish(INTERRUPTED_NOTICE);
  };

  private readonly onVideoResize = (): void => {
    const { video, recorder } = this;
    if (!video) return;
    this.update({ videoWidth: video.videoWidth, videoHeight: video.videoHeight });
    if (recorder?.pipeline.mode === 'direct') {
      const startedPortrait = recorder.pipeline.outW < recorder.pipeline.outH;
      if (startedPortrait !== video.videoWidth < video.videoHeight) this.hooks.onNotice(ROTATE_NOTICE);
    }
  };

  /** iOS suspends capture in the background, so a take cannot continue there. Save it. */
  private readonly onVisibility = (): void => {
    if (document.visibilityState === 'hidden') {
      if (this.recorder) void this.finish(INTERRUPTED_NOTICE);
      else this.cancelCountdown();
      return;
    }
    if (this.closed || !this.video || this.state.phase === 'starting' || this.state.phase === 'error') return;
    void this.meter.resume();
    const live = this.stream?.getVideoTracks().some((track) => track.readyState === 'live');
    if (live) void this.video.play().catch(() => undefined);
    else if (!this.recorder) void this.reopen();
  };

  private async reopen(): Promise<void> {
    if (!this.video) return;
    this.releaseCamera();
    await this.open(this.video);
  }

  private lockOrientation(): void {
    const orientation = screen.orientation as ScreenOrientation & { lock?: (type: string) => Promise<void> };
    orientation?.lock?.(orientation.type).catch(() => undefined);
  }

  private unlockOrientation(): void {
    try {
      screen.orientation?.unlock?.();
    } catch {
      // Unlock throws when the orientation was never locked.
    }
  }

  private releaseCamera(): void {
    this.video?.removeEventListener('resize', this.onVideoResize);
    this.stream?.getVideoTracks()[0]?.removeEventListener('ended', this.onTrackEnded);
    this.meter.stop();
    this.awake.disable();
    stopStream(this.stream);
    this.stream = null;
    if (this.video) this.video.srcObject = null;
  }

  /** Leaving the screen mid-take saves it, then releases the camera. */
  async close(): Promise<void> {
    this.closed = true;
    document.removeEventListener('visibilitychange', this.onVisibility);
    clearTimeout(this.countdownTimer);
    await this.finish();
    this.releaseCamera();
  }
}
