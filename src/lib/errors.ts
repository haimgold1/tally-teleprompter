export type AppErrorKind = 'permission' | 'in-use' | 'no-device' | 'unsupported' | 'insecure' | 'storage-full' | 'unknown';

const NAME_TO_KIND: Record<string, AppErrorKind> = {
  NotAllowedError: 'permission',
  PermissionDeniedError: 'permission',
  SecurityError: 'permission',
  NotReadableError: 'in-use',
  TrackStartError: 'in-use',
  AbortError: 'in-use',
  NotFoundError: 'no-device',
  DevicesNotFoundError: 'no-device',
};

const errorName = (error: unknown): string => (error as { name?: string } | null)?.name ?? '';

export function classifyCameraError(error: unknown): AppErrorKind {
  return NAME_TO_KIND[errorName(error)] ?? 'unknown';
}

export function isQuotaError(error: unknown): boolean {
  const name = errorName(error);
  const message = String((error as { message?: string } | null)?.message ?? '');
  return name === 'QuotaExceededError' || /quota|disk|space/i.test(message);
}

export interface ErrorCopy {
  title: string;
  body: string;
  steps?: string[];
}

export function errorCopy(kind: AppErrorKind, ios: boolean): ErrorCopy {
  switch (kind) {
    case 'permission':
      return {
        title: 'No access to camera and microphone',
        body: 'Recording needs both. Here is how to turn access back on:',
        steps: ios
          ? [
              'Open iPhone Settings → Safari.',
              'Under Camera and Microphone, choose Ask or Allow.',
              'In Safari you can also use the aA button in the address bar → Website Settings.',
              'Come back here and tap Try again.',
            ]
          : [
              'Tap the settings icon next to the address in Chrome → Permissions.',
              'Turn on Camera and Microphone.',
              'If the app is installed: device Settings → Apps → Tally → Permissions.',
              'Come back here and tap Try again.',
            ],
      };
    case 'in-use':
      return {
        title: 'Camera is in use',
        body: 'Another app is using the camera or microphone. Close it (including video calls or other browser tabs) and try again.',
      };
    case 'no-device':
      return { title: 'No camera found', body: 'No front camera or microphone was found on this device.' };
    case 'unsupported':
      return {
        title: 'Browser not supported',
        body: ios
          ? 'Video recording needs Safari on iOS 16 or later. Update your device or open this page in Safari.'
          : 'Video recording needs a recent version of Chrome. Update your browser and try again.',
      };
    case 'insecure':
      return { title: 'Secure connection required', body: 'Camera access only works over HTTPS.' };
    case 'storage-full':
      return {
        title: 'Storage is full',
        body: 'There is not enough room to save the video. Delete old takes or free up space on your device. Anything already recorded is saved.',
      };
    default:
      return { title: 'Something went wrong', body: 'The camera could not be started. Try again, and if it keeps happening, close and reopen the app.' };
  }
}
