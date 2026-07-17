import { Toolbar as ToolbarPrimitive } from '@base-ui/react';
import { cn } from 'cnfast';
import { type ComponentProps } from 'react';

export function ToolbarRoot({ className, ...props }: ComponentProps<typeof ToolbarPrimitive.Root>) {
  return (
    <ToolbarPrimitive.Root
      className={cn(
        'flex items-center gap-1 border-b border-border bg-surface px-2 py-1.5',
        className
      )}
      {...props}
    />
  );
}

export function ToolbarButton({
  className,
  ...props
}: ComponentProps<typeof ToolbarPrimitive.Button>) {
  return (
    <ToolbarPrimitive.Button
      className={cn(
        'inline-flex h-7 items-center justify-center gap-1.5 rounded-sm px-2 text-[13px] text-text-dim outline-none select-none',
        'hover:bg-surface-2 hover:text-text-base',
        'focus-visible:bg-surface-2 focus-visible:text-text-base',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
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
        'inline-flex h-7 items-center justify-center gap-1.5 rounded-sm px-2 text-[13px] text-text-dim outline-none select-none',
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
        'h-7 rounded-sm border border-border bg-surface px-2 text-[13px] text-text-base outline-none',
        'focus-visible:border-border-dark',
        className
      )}
      {...props}
    />
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
  Group: ToolbarGroup,
  Separator: ToolbarSeparator
};
