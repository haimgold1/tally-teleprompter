import { pickMimeType } from '../lib/mime';
import { aspectRatio, centerCrop, decidePipeline, type Aspect, type Pipeline } from '../lib/pipeline';

const VIDEO_BPS = 8_000_000;
const AUDIO_BPS = 192_000;
const CHUNK_MS = 1000;
const KEYFRAME_MS = 2000;
const CANVAS_FPS = 30;

export function supportedMimeType(): string | null {
  return pickMimeType((mime) => MediaRecorder.isTypeSupported(mime));
}

/** Center-crops the live camera into a canvas when its aspect differs from the target. */
class CropCompositor {
  readonly stream: MediaStream;
  private readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private running = true;

  constructor(
    private readonly video: HTMLVideoElement,
    width: number,
    height: number,
    private readonly ratio: number,
  ) {
    this.canvas.width = width;
    this.canvas.height = height;
    // iOS stops producing frames for a canvas that is not in the document.
    this.canvas.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none';
    document.body.append(this.canvas);
    this.ctx = this.canvas.getContext('2d', { alpha: false })!;
    this.stream = this.canvas.captureStream(CANVAS_FPS);
    this.draw();
  }

  private readonly draw = (): void => {
    if (!this.running) return;
    const { video, ctx, canvas } = this;
    if (video.videoWidth) {
      const { sx, sy, sw, sh } = centerCrop(video.videoWidth, video.videoHeight, this.ratio);
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    }
    if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(this.draw);
    else requestAnimationFrame(this.draw);
  };

  stop(): void {
    this.running = false;
    this.stream.getTracks().forEach((track) => track.stop());
    this.canvas.remove();
  }
}

export interface RecorderConfig {
  stream: MediaStream;
  /** The processed voice, or the raw microphone as a fallback. */
  audioTrack: MediaStreamTrack | undefined;
  video: HTMLVideoElement;
  aspect: Aspect;
  onChunk: (blob: Blob, elapsedMs: number) => void;
  onError: (error: unknown) => void;
}

export function planRecording(video: HTMLVideoElement, aspect: Aspect): Pipeline {
  return decidePipeline(video.videoWidth, video.videoHeight, aspect);
}

/**
 * One take. The preview is mirrored with CSS only and the prompter is a DOM
 * overlay, so neither can reach the frames recorded here.
 */
export class TakeRecorder {
  readonly pipeline: Pipeline;
  readonly mimeType: string;
  private readonly recorder: MediaRecorder;
  private readonly compositor: CropCompositor | null = null;
  private startedAt = 0;
  private pausedAt = 0;
  private pausedTotal = 0;

  constructor(config: RecorderConfig) {
    const { stream, audioTrack, video, aspect } = config;
    this.pipeline = planRecording(video, aspect);

    let videoTracks = stream.getVideoTracks();
    if (this.pipeline.mode === 'crop') {
      this.compositor = new CropCompositor(video, this.pipeline.outW, this.pipeline.outH, aspectRatio(aspect));
      videoTracks = this.compositor.stream.getVideoTracks();
    }
    const tracks = audioTrack ? [...videoTracks, audioTrack] : videoTracks;

    const picked = supportedMimeType();
    // Chrome's MP4 muxer only emits data at keyframes, so this bounds what a crash can lose.
    const options: MediaRecorderOptions & { videoKeyFrameIntervalDuration: number } = {
      videoBitsPerSecond: VIDEO_BPS,
      audioBitsPerSecond: AUDIO_BPS,
      videoKeyFrameIntervalDuration: KEYFRAME_MS,
    };
    if (picked) options.mimeType = picked;
    const recordStream = new MediaStream(tracks);
    this.recorder = new MediaRecorder(recordStream, options);
    this.mimeType = this.recorder.mimeType || picked || 'video/mp4';

    this.recorder.ondataavailable = (event) => {
      if (event.data?.size) config.onChunk(event.data, this.elapsedMs);
    };
    this.recorder.onerror = (event) => config.onError((event as Event & { error?: unknown }).error ?? event);
  }

  get elapsedMs(): number {
    if (!this.startedAt) return 0;
    const end = this.pausedAt || performance.now();
    return Math.max(0, end - this.startedAt - this.pausedTotal);
  }

  get state(): RecordingState {
    return this.recorder.state;
  }

  /** Resolves when the first frames are captured, so the text can start in sync. */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => began(), 3000);
      const began = () => {
        clearTimeout(timeout);
        this.startedAt ||= performance.now();
        resolve();
      };
      this.recorder.onstart = began;
      try {
        this.recorder.start(CHUNK_MS);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  pause(): void {
    if (this.recorder.state !== 'recording') return;
    this.recorder.pause();
    this.pausedAt = performance.now();
  }

  resume(): void {
    if (this.recorder.state !== 'paused') return;
    this.recorder.resume();
    this.pausedTotal += performance.now() - this.pausedAt;
    this.pausedAt = 0;
  }

  /** Resolves after the final chunk. The timeout covers iOS not firing `stop` on a dead track. */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      const finish = () => {
        clearTimeout(timeout);
        this.compositor?.stop();
        resolve();
      };
      const timeout = setTimeout(finish, 5000);
      if (this.recorder.state === 'inactive') {
        finish();
        return;
      }
      this.recorder.onstop = finish;
      try {
        this.recorder.stop();
      } catch {
        finish();
      }
    });
  }
}

/** A small unmirrored JPEG of the current frame, cropped like the recording. */
export function grabThumbnail(video: HTMLVideoElement, aspect: Aspect): string | undefined {
  if (!video.videoWidth) return undefined;
  const ratio = aspectRatio(aspect);
  const longSide = 320;
  const canvas = document.createElement('canvas');
  canvas.width = ratio < 1 ? Math.round(longSide * ratio) : longSide;
  canvas.height = ratio < 1 ? longSide : Math.round(longSide / ratio);
  const { sx, sy, sw, sh } = centerCrop(video.videoWidth, video.videoHeight, ratio);
  canvas.getContext('2d')?.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.72);
}
