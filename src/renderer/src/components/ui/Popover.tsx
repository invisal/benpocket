import { Popover as PopoverPrimitive } from '@base-ui/react';
import { cn } from 'cnfast';
import { type ComponentProps } from 'react';

export function PopoverContent({
  className,
  children,
  sideOffset = 8,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Positioner>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner sideOffset={sideOffset} className="z-50 outline-none" {...props}>
        <PopoverPrimitive.Popup
          className={cn(
            // Caps at whatever room the Positioner actually found on
            // whichever side it flipped to (--available-height) and scrolls
            // internally past that, rather than silently rendering outside
            // the host window's bounds -- callers here can run inside small,
            // fixed-size, non-resizable windows (e.g. the focus toolbar)
            // where there's no OS chrome to clip against, just empty space.
            'max-h-[min(24rem,var(--available-height))] min-w-[10rem] overflow-y-auto rounded-md border border-border-dark bg-surface p-2 text-text-base shadow-lg outline-none',
            'origin-[var(--transform-origin)] transition-[transform,opacity]',
            'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
            'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
            className
          )}
        >
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const Popover = {
  Root: PopoverPrimitive.Root,
  Trigger: PopoverPrimitive.Trigger,
  Content: PopoverContent,
  Close: PopoverPrimitive.Close,
  Title: PopoverPrimitive.Title,
  Description: PopoverPrimitive.Description
};
