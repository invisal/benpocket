import { Toolbar as ToolbarPrimitive } from '@base-ui/react';
import { cn } from 'cnfast';
import { type ComponentProps, type HTMLAttributes } from 'react';

export function ToolbarRoot({ className, ...props }: ComponentProps<typeof ToolbarPrimitive.Root>) {
  return (
    <ToolbarPrimitive.Root
      className={cn(
        'flex h-9 items-center border-b border-border bg-surface',
        'divide-x divide-border',
        className
      )}
      {...props}
    />
  );
}

type ToolbarButtonVariant = 'default' | 'primary';

const toolbarButtonVariantClasses: Record<ToolbarButtonVariant, string> = {
  default: 'hover:bg-surface-3 hover:text-text-base',
  primary: 'bg-accent text-emphasis-text hover:brightness-[1.05]'
};

export function ToolbarButton({
  className,
  shape = 'default',
  variant = 'default',
  ...props
}: ComponentProps<typeof ToolbarPrimitive.Button> & {
  shape?: 'square' | 'default';
  variant?: ToolbarButtonVariant;
}) {
  return (
    <ToolbarPrimitive.Button
      className={cn(
        'h-full px-3 gap-1 outline-none select-none',
        'inline-flex items-center justify-center',
        'cursor-pointer',
        'text-xs',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        toolbarButtonVariantClasses[variant],
        shape === 'square' && 'aspect-square px-0',
        className
      )}
      {...props}
    />
  );
}

export function ToolbarLink({ className, ...props }: ComponentProps<typeof ToolbarPrimitive.Link>) {
  return (
    <ToolbarPrimitive.Link
      className={cn(
        'inline-flex h-full items-center justify-center gap-1.5 rounded-sm px-2 text-[13px] text-text-dim outline-none select-none',
        'hover:bg-surface-2 hover:text-text-base',
        'focus-visible:bg-surface-2 focus-visible:text-text-base',
        className
      )}
      {...props}
    />
  );
}

export function ToolbarInput({
  className,
  ...props
}: ComponentProps<typeof ToolbarPrimitive.Input>) {
  return (
    <ToolbarPrimitive.Input
      className={cn(
        'h-full bg-surface hover:bg-surface-2 px-3 text-xs outline-none',
        'focus-visible:border-border-dark',
        className
      )}
      {...props}
    />
  );
}

export function ToolbarLabel({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'px-2 h-full flex items-center text-xs text-muted-foreground select-none',
        className
      )}
      {...props}
    />
  );
}

export function ToolbarFreeSpace({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('h-full flex-1 bg-surface-2 bg-diagonal-stripes', className)} {...props} />
  );
}

export function ToolbarGroup({
  className,
  ...props
}: ComponentProps<typeof ToolbarPrimitive.Group>) {
  return <ToolbarPrimitive.Group className={cn('flex items-center gap-1', className)} {...props} />;
}

export function ToolbarSeparator({
  className,
  ...props
}: ComponentProps<typeof ToolbarPrimitive.Separator>) {
  return (
    <ToolbarPrimitive.Separator
      className={cn('mx-1 h-4 w-px bg-border-dark', className)}
      {...props}
    />
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const Toolbar = {
  Root: ToolbarRoot,
  Button: ToolbarButton,
  Link: ToolbarLink,
  Input: ToolbarInput,
  Label: ToolbarLabel,
  FreeSpace: ToolbarFreeSpace,
  Group: ToolbarGroup,
  Separator: ToolbarSeparator
};
