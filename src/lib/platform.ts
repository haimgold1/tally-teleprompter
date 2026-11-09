export function isIOS(): boolean {
  return /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  return matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

export function iosVersion(): number | null {
  const match = navigator.userAgent.match(/OS (\d+)[_.](\d+)/);
  return match ? Number(match[1]) + Number(match[2]) / 100 : null;
}

/** Wake Lock resolves but has no effect in installed iOS web apps before 18.4. */
export function wakeLockIsReliable(): boolean {
  if (!('wakeLock' in navigator)) return false;
  if (!isIOS() || !isStandalone()) return true;
  return (iosVersion() ?? 99) >= 18.04;
}

export function prefersReducedMotion(): boolean {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}
