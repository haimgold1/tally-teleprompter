import { WPM_MAX, WPM_MIN } from '../../lib/wpm';
import { RANGES, type Settings } from '../../storage/settings';
import { Slider, Switch } from '../components/fields';
import { Sheet } from '../components/Sheet';

interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  patch: (change: Partial<Settings>) => void;
}

export function SettingsSheet({ open, onClose, settings, patch }: SettingsSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Text settings" clearScrim>
      <Slider label="Speed" display={`${settings.wpm} wpm`} value={settings.wpm} min={WPM_MIN} max={WPM_MAX} step={5} onChange={(wpm) => patch({ wpm })} />
      <Slider label="Text size" display={`${settings.fontSize}`} value={settings.fontSize} {...RANGES.fontSize} onChange={(fontSize) => patch({ fontSize })} />
      <Slider label="Line height" display={settings.lineHeight.toFixed(2)} value={settings.lineHeight} {...RANGES.lineHeight} onChange={(lineHeight) => patch({ lineHeight })} />
      <Slider label="Panel height" display={`${settings.panelHeight}%`} value={settings.panelHeight} {...RANGES.panelHeight} onChange={(panelHeight) => patch({ panelHeight })} />
      <Slider label="Panel opacity" display={`${settings.panelOpacity}%`} value={settings.panelOpacity} {...RANGES.panelOpacity} onChange={(panelOpacity) => patch({ panelOpacity })} />
      <Slider label="Margins" display={`${settings.margin}%`} value={settings.margin} {...RANGES.margin} onChange={(margin) => patch({ margin })} />
      <Switch label="Reading line" checked={settings.readingLine} onChange={(readingLine) => patch({ readingLine })} />
      <Switch label="Mirror text (beam-splitter glass)" checked={settings.mirrorText} onChange={(mirrorText) => patch({ mirrorText })} />
      <Switch label="Rule-of-thirds grid" checked={settings.grid} onChange={(grid) => patch({ grid })} />
      <Switch label="Pause text when recording pauses" checked={settings.autoPauseText} onChange={(autoPauseText) => patch({ autoPauseText })} />
    </Sheet>
  );
}
