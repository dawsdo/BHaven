export default function Stepper({ value, onChange, min = 0, max = 99, label, size = 'md' }) {
  return (
    <div className={'stepper stepper-' + size}>
      <button
        type="button"
        aria-label={'One fewer, ' + label}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </button>
      <output aria-live="polite" aria-label={label}>
        {value}
      </output>
      <button
        type="button"
        aria-label={'One more, ' + label}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </button>
    </div>
  );
}
