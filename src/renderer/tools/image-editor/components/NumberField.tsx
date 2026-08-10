interface NumberFieldProps {
  label: string;
  value: number;
  onCommit: (value: number) => void;
}

/** Compact number input for a toolbar row: only commits on blur/Enter, so mid-typing states don't
 * get clamped away. */
export function NumberField({ label, value, onCommit }: NumberFieldProps) {
  const rounded = Math.round(value);
  return (
    <label className="flex h-full items-center gap-1 px-1.5 text-xs text-muted-foreground select-none">
      {label}
      <input
        type="number"
        defaultValue={rounded}
        key={rounded}
        onBlur={(e) => {
          const next = Number(e.target.value);
          if (Number.isFinite(next)) onCommit(next);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        className="w-12 min-w-0 bg-transparent text-[12px] text-foreground outline-none"
      />
    </label>
  );
}
