import { useCallback, useState } from 'preact/hooks';
import { loadSettings, saveSettings, type Settings } from '../storage/settings';

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const [settings, setSettings] = useState(loadSettings);
  const patch = useCallback((change: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...change };
      saveSettings(next);
      return next;
    });
  }, []);
  return [settings, patch];
}
