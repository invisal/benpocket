import { type ButtonHTMLAttributes, type Ref } from 'react';
import { cn } from 'cnfast';

type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost' | 'outline';
type ButtonSize = 'lg' | 'md' | 'sm';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  ref?: Ref<HTMLButtonElement>;
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-7 gap-1.5 px-2.5 text-sm',
  md: 'h-8 gap-2 px-3.5 text-sm',
  lg: 'h-10 gap-2 px-5 text-base'
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: cn('border border-transparent bg-accent hover:bg-accent/80 text-emphasis-text'),
  destructive: cn('border border-transparent bg-danger text-emphasis-text'),
  outline: cn('border border-border-dark bg-surface hover:bg-surface-3 text-foreground'),
  secondary: cn(
    'border border-gray-300 dark:border-stone-600 bg-surface-2 hover:bg-surface-3 text-foreground'
  ),
  ghost: cn('border border-transparent bg-transparent text-text-dim')
};

export function Button({
  children,
  variant = 'outline',
  size = 'md',
  type = 'button',
  className,
  disabled,
  ref,
  ...props
}: ButtonProps) {
  return (
    <button
      ref={ref}
      disabled={disabled}
      type={type}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium select-none cursor-pointer',
        'transition-[transform,box-shadow,filter,background-color,border-color] duration-100 ease-out',
        'active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-editor-bg',
        'disabled:pointer-events-none disabled:scale-100 disabled:opacity-50 disabled:shadow-none',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
