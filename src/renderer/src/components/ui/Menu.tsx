import { Menu as MenuPrimitive } from '@base-ui/react';
import { cn } from 'cnfast';
import { type ComponentProps } from 'react';

export function MenuContent({
  className,
  children,
  sideOffset = 4,
  ...props
}: ComponentProps<typeof MenuPrimitive.Positioner>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner sideOffset={sideOffset} className="z-50 outline-none" {...props}>
        <MenuPrimitive.Popup
          className={cn(
            'max-h-[min(24rem,var(--available-height))] min-w-[10rem] overflow-y-auto rounded-md border border-border-dark bg-surface p-1 text-text-base shadow-lg outline-none',
            'origin-[var(--transform-origin)] transition-[transform,opacity]',
            'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
            'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
            className
          )}
        >
          {children}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

export function MenuItem({ className, ...props }: ComponentProps<typeof MenuPrimitive.Item>) {
  return (
    <MenuPrimitive.Item
      className={cn(
        'relative flex cursor-pointer items-center gap-2 rounded-sm py-1.5 pr-2 pl-2 text-[13px] outline-none select-none',
        'data-[highlighted]:bg-border-dark/60 data-[highlighted]:text-text-base',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
      {...props}
    />
  );
}

export function MenuGroupLabel({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.GroupLabel>) {
  return (
    <MenuPrimitive.GroupLabel
      className={cn('px-2 py-1.5 text-[11px] font-medium text-text-dim', className)}
      {...props}
    />
  );
}

export function MenuSeparator({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Separator>) {
  return (
    <MenuPrimitive.Separator
      className={cn('-mx-1 my-1 h-px bg-border-dark', className)}
      {...props}
    />
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const Menu = {
  Root: MenuPrimitive.Root,
  Trigger: MenuPrimitive.Trigger,
  Content: MenuContent,
  Item: MenuItem,
  Group: MenuPrimitive.Group,
  GroupLabel: MenuGroupLabel,
  Separator: MenuSeparator
};
