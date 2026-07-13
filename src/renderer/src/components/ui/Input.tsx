import { type InputHTMLAttributes, type Ref } from 'react';
import { cn } from 'cnfast';

type InputSize = 'lg' | 'md' | 'sm';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: InputSize;
  ref?: Ref<HTMLInputElement>;
}

const sizeClasses: Record<InputSize, string> = {
  sm: 'h-7 px-2.5 text-xs',
  md: 'h-8 px-3 text-[13px]',
  lg: 'h-10 px-4 text-[15px]'
};

export function Input({ size = 'md', className, ref, disabled, ...props }: InputProps) {
  return (
    <input
      ref={ref}
      disabled={disabled}
      className={cn(
        'w-full rounded-md border border-border bg-surface',
        'duration-100 ease-out',
        'focus-visible:outline-none',
        'disabled:pointer-events-none disabled:opacity-50',
        sizeClasses[size],
        className
      )}
      {...props}
    />
  );
}
