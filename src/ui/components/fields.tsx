interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}

export function Slider({ label, value, min, max, step, display, onChange }: SliderProps) {
  const percent = ((value - min) / (max - min)) * 100;
  return (
    <label class="field">
      <div class="field__head">
        <span>{label}</span>
        <span class="field__value">{display}</span>
      </div>
      <input
        class="range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--pct': `${percent}%` }}
        onInput={(event) => onChange(Number((event.currentTarget as HTMLInputElement).value))}
        onPointerUp={(event) => (event.currentTarget as HTMLInputElement).blur()}
      />
    </label>
  );
}

interface SwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function Switch({ label, checked, onChange }: SwitchProps) {
  return (
    <button class="switch-row" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
      <span>{label}</span>
      <span class="switch" />
    </button>
  );
}
