import { type InputHTMLAttributes, type Ref, useId } from 'react';
import { cn } from 'cnfast';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: string;
  ref?: Ref<HTMLInputElement>;
}

export function Checkbox({ label, className, id, ref, ...props }: CheckboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  const input = (
    <input
      ref={ref}
      type="checkbox"
      id={inputId}
      className={cn('accent-strong', className)}
      {...props}
    />
  );

  if (!label) return input;

  return (
    <label
      htmlFor={inputId}
      className="inline-flex items-center gap-2 text-xs text-foreground select-none cursor-pointer"
    >
      {input}
      {label}
    </label>
  );
}
