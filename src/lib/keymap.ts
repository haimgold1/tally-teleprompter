export type KeyAction = 'toggle-text' | 'jump-back' | 'speed-up' | 'speed-down' | 'toggle-record';

export interface KeyLike {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

const BY_KEY: Record<string, KeyAction> = {
  ' ': 'toggle-text',
  Spacebar: 'toggle-text',
  Enter: 'toggle-text',
  PageDown: 'toggle-text',
  ArrowRight: 'toggle-text',
  MediaPlayPause: 'toggle-text',
  PageUp: 'jump-back',
  ArrowLeft: 'jump-back',
  ArrowUp: 'speed-up',
  ArrowDown: 'speed-down',
  r: 'toggle-record',
  R: 'toggle-record',
};

/** Maps a key event to a studio action. Key R also matches on a Hebrew layout (ר). */
export function actionForKey(event: KeyLike): KeyAction | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  if (event.code === 'KeyR') return 'toggle-record';
  return BY_KEY[event.key] ?? null;
}
