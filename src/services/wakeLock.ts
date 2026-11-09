export class ScreenAwake {
  private sentinel: WakeLockSentinel | null = null;
  private wanted = false;

  private readonly onVisibility = (): void => {
    if (document.visibilityState === 'visible' && this.wanted) void this.acquire();
  };

  async enable(): Promise<void> {
    if (this.wanted) return;
    this.wanted = true;
    document.addEventListener('visibilitychange', this.onVisibility);
    await this.acquire();
  }

  disable(): void {
    this.wanted = false;
    document.removeEventListener('visibilitychange', this.onVisibility);
    void this.sentinel?.release().catch(() => undefined);
    this.sentinel = null;
  }

  private async acquire(): Promise<void> {
    if (!('wakeLock' in navigator) || (this.sentinel && !this.sentinel.released)) return;
    try {
      this.sentinel = await navigator.wakeLock.request('screen');
    } catch {
      // Refused (low battery, hidden page). Retried the next time the page is visible.
    }
  }
}
