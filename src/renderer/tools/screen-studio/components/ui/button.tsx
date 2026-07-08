import type { ButtonHTMLAttributes, JSX } from 'react';
import { cn } from '../../lib/utils';

type ButtonVariant = 'default' | 'secondary';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  default: 'bg-accent text-white hover:brightness-110',
  secondary: 'bg-white/10 text-white hover:bg-white/15'
};

export function Button({ variant = 'default', className, ...props }: ButtonProps): JSX.Element {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
