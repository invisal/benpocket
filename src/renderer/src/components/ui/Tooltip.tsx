import { Tooltip as TooltipPrimitive } from '@base-ui/react';
import { cn } from 'cnfast';
import { type ComponentProps } from 'react';

export function TooltipContent({
  className,
  children,
  sideOffset = 6,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Positioner>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner sideOffset={sideOffset} className="z-50 outline-none" {...props}>
        <TooltipPrimitive.Popup
          className={cn(
            'rounded-md border border-border-dark bg-surface px-2 py-1 text-[11px] font-medium text-text-base shadow-lg outline-none',
            'origin-[var(--transform-origin)] transition-[transform,opacity]',
            'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
            'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
            className
          )}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const Tooltip = {
  Provider: TooltipPrimitive.Provider,
  Root: TooltipPrimitive.Root,
  Trigger: TooltipPrimitive.Trigger,
  Content: TooltipContent
};
