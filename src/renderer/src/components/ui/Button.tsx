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
  sm: 'h-7 gap-1.5 px-2.5 text-xs',
  md: 'h-8 gap-2 px-3.5 text-[13px]',
  lg: 'h-10 gap-2 px-5 text-[15px]'
};

// Raised look is built entirely from inset shadow overlays (top highlight +
// recessed bottom edge) rather than a drop shadow, so the same recipe reads
// correctly against either the accent or danger color token in both themes
// without the button ever casting a shadow onto the page behind it.
const raisedShadow =
  'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35),inset_0_-2px_0_0_rgba(0,0,0,0.25),inset_0_0_0_1px_rgba(0,0,0,0.12)]';
const raisedShadowActive =
  'active:shadow-[inset_0_2px_3px_0_rgba(0,0,0,0.35),inset_0_0_0_1px_rgba(0,0,0,0.12)]';

// Each 3d variant pairs a raised idle shadow (inset top highlight + inset
// recessed bottom edge) with a pressed active state that flips to an inset
// top shadow and sinks the button by 1px, so it reads as a physical keycap.
const variantClasses: Record<ButtonVariant, string> = {
  primary: cn(
    'border border-transparent bg-accent text-emphasis-text',
    raisedShadow,
    'hover:brightness-[1.05]',
    'active:translate-y-[1px]',
    raisedShadowActive
  ),
  destructive: cn(
    'border border-transparent bg-danger text-emphasis-text',
    raisedShadow,
    'hover:brightness-[1.05]',
    'active:translate-y-[1px]',
    raisedShadowActive
  ),
  outline: cn(
    'border border-border-dark bg-surface text-text-base',
    'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),inset_0_-1px_0_0_rgba(0,0,0,0.2)]',
    'hover:brightness-[1.1]',
    'active:translate-y-[1px] active:shadow-[inset_0_2px_3px_0_rgba(0,0,0,0.3)]'
  ),
  secondary: cn(
    'border border-border-dark bg-sidebar-bg text-text-base',
    'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),inset_0_-1px_0_0_rgba(0,0,0,0.25)]',
    'hover:bg-border-dark/40',
    'active:translate-y-[1px] active:bg-activity-bg active:shadow-[inset_0_1px_3px_0_rgba(0,0,0,0.3)]'
  ),
  ghost: cn(
    'border border-transparent bg-transparent text-text-dim',
    'hover:bg-border-dark/60 hover:text-text-base',
    'active:bg-border-dark'
  )
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
        // pb-px: the inset bottom shadow reads as a recessed edge rather
        // than content space, which visually shrinks the gap below the
        // content — a hair of extra bottom padding re-centers it without
        // touching the fixed height.
        'inline-flex items-center justify-center whitespace-nowrap rounded-md pb-px font-medium select-none cursor-pointer',
        'transition-[transform,box-shadow,filter,background-color,border-color] duration-100 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-editor-bg',
        'disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none',
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
