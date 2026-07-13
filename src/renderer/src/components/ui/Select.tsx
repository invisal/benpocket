import { Select as SelectPrimitive } from '@base-ui/react';
import { cn } from 'cnfast';
import { Check, ChevronDown } from 'lucide-react';
import { ComponentProps } from 'react';
import { Button } from './Button';

export function SelectTrigger({
  children,
  variant,
  size,
  icon,
  ...props
}: ComponentProps<typeof SelectPrimitive.Trigger> & {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost' | 'outline';
  size?: 'lg' | 'md' | 'sm';
  icon?: React.ReactNode;
}) {
  return (
    <SelectPrimitive.Trigger
      render={<Button type="button" variant={variant} size={size} />}
      {...props}
    >
      <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
        {icon && <span className="flex items-center shrink-0">{icon}</span>}
        {children}
      </div>
      <SelectPrimitive.Icon className="flex items-center text-text-dim shrink-0">
        <ChevronDown className="size-3.5" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  sideOffset = 4,
  ...props
}: ComponentProps<typeof SelectPrimitive.Positioner>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner sideOffset={sideOffset} className="z-50 outline-none" {...props}>
        <SelectPrimitive.Popup
          className={cn(
            'max-h-[min(24rem,var(--available-height))] min-w-[var(--anchor-width)] overflow-y-auto rounded-md border border-border-dark bg-surface p-1 text-text-base shadow-lg',
            'origin-[var(--transform-origin)] transition-[transform,opacity]',
            'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
            'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
            className
          )}
        >
          {children}
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        'relative flex cursor-pointer items-center gap-2 rounded-sm py-1.5 pr-7 pl-2 text-[13px] outline-none select-none',
        'data-[highlighted]:bg-border-dark/60 data-[highlighted]:text-text-base',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-2 flex items-center text-accent">
        <Check className="size-3.5" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const Select = {
  Root: SelectPrimitive.Root,
  Value: SelectPrimitive.Value,
  ItemText: SelectPrimitive.ItemText,
  Item: SelectItem,
  Content: SelectContent,
  Trigger: SelectTrigger
};
