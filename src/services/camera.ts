import { classifyCameraError } from '../lib/errors';

const AUDIO: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: true,
  autoGainControl: false,
  channelCount: { ideal: 1 },
  sampleRate: { ideal: 48000 },
};

const VIDEO_TIERS: MediaTrackConstraints[] = [
  { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
  { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
  { facingMode: 'user' },
];

export function cameraSupport(): 'ok' | 'insecure' | 'unsupported' {
  if (!window.isSecureContext) return 'insecure';
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return 'unsupported';
  return 'ok';
}

/**
 * Opens the front camera at the best available tier. A busy camera and an
 * over-constrained request can both be resolution-specific, so those fall
 * through to the next tier; a permission refusal stops immediately.
 */
export async function openCamera(): Promise<MediaStream> {
  let lastError: unknown;
  for (const video of VIDEO_TIERS) {
    try {
      return await navigator.mediaDevices.getUserMedia({ video, audio: AUDIO });
    } catch (error) {
      lastError = error;
      const name = (error as { name?: string }).name;
      if (name !== 'OverconstrainedError' && classifyCameraError(error) !== 'in-use') throw error;
    }
  }
  throw lastError;
}

export function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

/** Binds a stream to a preview element with the attributes iOS requires for inline play. */
export async function attachPreview(video: HTMLVideoElement, stream: MediaStream): Promise<void> {
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('muted', '');
  video.srcObject = stream;
  if (video.readyState < HTMLMediaElement.HAVE_METADATA || !video.videoWidth) {
    await new Promise<void>((resolve) => {
      video.addEventListener('loadedmetadata', () => resolve(), { once: true });
      setTimeout(resolve, 4000);
    });
  }
  await video.play().catch(() => undefined);
}
