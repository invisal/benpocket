import { ContextMenu as ContextMenuPrimitive } from '@base-ui/react';
import { cn } from 'cnfast';
import { Check, ChevronRight, Circle } from 'lucide-react';
import { ComponentProps } from 'react';

export function ContextMenuContent({
  className,
  children,
  sideOffset = 4,
  ...props
}: ComponentProps<typeof ContextMenuPrimitive.Positioner>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Positioner
        sideOffset={sideOffset}
        className="z-50 outline-none"
        {...props}
      >
        <ContextMenuPrimitive.Popup
          className={cn(
            'max-h-[min(24rem,var(--available-height))] min-w-[10rem] overflow-y-auto rounded-md border border-border-dark bg-surface p-1 text-text-base shadow-lg outline-none',
            'origin-[var(--transform-origin)] transition-[transform,opacity]',
            'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
            'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
            className
          )}
        >
          {children}
        </ContextMenuPrimitive.Popup>
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  );
}

export function ContextMenuItem({
  className,
  children,
  ...props
}: ComponentProps<typeof ContextMenuPrimitive.Item>) {
  return (
    <ContextMenuPrimitive.Item
      className={cn(
        'relative flex cursor-pointer items-center gap-2 rounded-sm py-1.5 pr-2 pl-2 text-[13px] outline-none select-none',
        'data-[highlighted]:bg-border-dark/60 data-[highlighted]:text-text-base',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
      {...props}
    >
      {children}
    </ContextMenuPrimitive.Item>
  );
}

export function ContextMenuCheckboxItem({
  className,
  children,
  ...props
}: ComponentProps<typeof ContextMenuPrimitive.CheckboxItem>) {
  return (
    <ContextMenuPrimitive.CheckboxItem
      className={cn(
        'relative flex cursor-pointer items-center gap-2 rounded-sm py-1.5 pr-2 pl-7 text-[13px] outline-none select-none',
        'data-[highlighted]:bg-border-dark/60 data-[highlighted]:text-text-base',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
      {...props}
    >
      <ContextMenuPrimitive.CheckboxItemIndicator className="absolute left-2 flex items-center text-accent">
        <Check className="size-3.5" />
      </ContextMenuPrimitive.CheckboxItemIndicator>
      {children}
    </ContextMenuPrimitive.CheckboxItem>
  );
}

export function ContextMenuRadioItem({
  className,
  children,
  ...props
}: ComponentProps<typeof ContextMenuPrimitive.RadioItem>) {
  return (
    <ContextMenuPrimitive.RadioItem
      className={cn(
        'relative flex cursor-pointer items-center gap-2 rounded-sm py-1.5 pr-2 pl-7 text-[13px] outline-none select-none',
        'data-[highlighted]:bg-border-dark/60 data-[highlighted]:text-text-base',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
      {...props}
    >
      <ContextMenuPrimitive.RadioItemIndicator className="absolute left-2 flex items-center text-accent">
        <Circle className="size-2 fill-current" />
      </ContextMenuPrimitive.RadioItemIndicator>
      {children}
    </ContextMenuPrimitive.RadioItem>
  );
}

export function ContextMenuGroupLabel({
  className,
  ...props
}: ComponentProps<typeof ContextMenuPrimitive.GroupLabel>) {
  return (
    <ContextMenuPrimitive.GroupLabel
      className={cn('px-2 py-1.5 text-[11px] font-medium text-text-dim', className)}
      {...props}
    />
  );
}

export function ContextMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof ContextMenuPrimitive.Separator>) {
  return (
    <ContextMenuPrimitive.Separator
      className={cn('-mx-1 my-1 h-px bg-border-dark', className)}
      {...props}
    />
  );
}

export function ContextMenuSubmenuTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof ContextMenuPrimitive.SubmenuTrigger>) {
  return (
    <ContextMenuPrimitive.SubmenuTrigger
      className={cn(
        'relative flex cursor-pointer items-center gap-2 rounded-sm py-1.5 pr-2 pl-2 text-[13px] outline-none select-none',
        'data-[highlighted]:bg-border-dark/60 data-[highlighted]:text-text-base',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto size-3.5 text-text-dim" />
    </ContextMenuPrimitive.SubmenuTrigger>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const ContextMenu = {
  Root: ContextMenuPrimitive.Root,
  Trigger: ContextMenuPrimitive.Trigger,
  Content: ContextMenuContent,
  Item: ContextMenuItem,
  CheckboxItem: ContextMenuCheckboxItem,
  RadioGroup: ContextMenuPrimitive.RadioGroup,
  RadioItem: ContextMenuRadioItem,
  Group: ContextMenuPrimitive.Group,
  GroupLabel: ContextMenuGroupLabel,
  Separator: ContextMenuSeparator,
  SubmenuRoot: ContextMenuPrimitive.SubmenuRoot,
  SubmenuTrigger: ContextMenuSubmenuTrigger
};
