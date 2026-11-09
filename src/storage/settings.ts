import type { Aspect } from '../lib/pipeline';
import { clampWpm, WPM_DEFAULT } from '../lib/wpm';

export interface Settings {
  wpm: number;
  fontSize: number;
  lineHeight: number;
  panelHeight: number;
  panelOpacity: number;
  margin: number;
  mirrorText: boolean;
  readingLine: boolean;
  grid: boolean;
  autoPauseText: boolean;
  aspect: Aspect;
}

export const DEFAULT_SETTINGS: Settings = {
  wpm: WPM_DEFAULT,
  fontSize: 36,
  lineHeight: 1.45,
  panelHeight: 36,
  panelOpacity: 72,
  margin: 6,
  mirrorText: false,
  readingLine: true,
  grid: false,
  autoPauseText: true,
  aspect: '9:16',
};

export const RANGES = {
  fontSize: { min: 20, max: 72, step: 1 },
  lineHeight: { min: 1.1, max: 2, step: 0.05 },
  panelHeight: { min: 20, max: 70, step: 1 },
  panelOpacity: { min: 20, max: 100, step: 1 },
  margin: { min: 0, max: 25, step: 1 },
} as const;

const KEY = 'tally.settings.v1';

function clampRange(value: unknown, key: keyof typeof RANGES): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_SETTINGS[key];
  return Math.min(RANGES[key].max, Math.max(RANGES[key].min, number));
}

const bool = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback);

/** Accepts anything from storage and always returns valid settings. */
export function sanitizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof Settings, unknown>>;
  const d = DEFAULT_SETTINGS;
  return {
    wpm: typeof r.wpm === 'number' && Number.isFinite(r.wpm) ? clampWpm(r.wpm) : d.wpm,
    fontSize: clampRange(r.fontSize, 'fontSize'),
    lineHeight: clampRange(r.lineHeight, 'lineHeight'),
    panelHeight: clampRange(r.panelHeight, 'panelHeight'),
    panelOpacity: clampRange(r.panelOpacity, 'panelOpacity'),
    margin: clampRange(r.margin, 'margin'),
    mirrorText: bool(r.mirrorText, d.mirrorText),
    readingLine: bool(r.readingLine, d.readingLine),
    grid: bool(r.grid, d.grid),
    autoPauseText: bool(r.autoPauseText, d.autoPauseText),
    aspect: r.aspect === '16:9' ? '16:9' : '9:16',
  };
}

export function loadSettings(): Settings {
  try {
    return sanitizeSettings(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Settings are a convenience; losing them must never break recording.
  }
}
