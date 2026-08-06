import { Tabs as TabsPrimitive } from '@base-ui/react';
import { cn } from 'cnfast';
import { type ComponentProps } from 'react';

export function TabPanel({ className, ...props }: ComponentProps<typeof TabsPrimitive.Panel>) {
  return <TabsPrimitive.Panel className={cn('outline-none', className)} {...props} />;
}

export function PillTabList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn('flex items-center gap-1', className)} {...props} />;
}

export function PillTabItem({ className, ...props }: ComponentProps<typeof TabsPrimitive.Tab>) {
  return (
    <TabsPrimitive.Tab
      className={cn(
        'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer outline-none transition-colors',
        'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
        'data-[active]:bg-accent/10 data-[active]:text-accent',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
      {...props}
    />
  );
}

/** Pill-style tabs: active tab fills with the accent tint. */
// eslint-disable-next-line react-refresh/only-export-components
export const PillTab = {
  Root: TabsPrimitive.Root,
  List: PillTabList,
  Item: PillTabItem,
  Panel: TabPanel
};

export function UnderlineTabList({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List className={cn('relative flex items-center gap-1', className)} {...props} />
  );
}

export function UnderlineTabItem({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Tab>) {
  return (
    <TabsPrimitive.Tab
      className={cn(
        'cursor-pointer px-3 py-1.5 text-xs font-medium text-muted-foreground outline-none transition-colors',
        'hover:text-foreground',
        'data-[active]:text-accent',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
      {...props}
    />
  );
}

/** Sliding underline — render as a child of `UnderlineTab.List`, alongside the items. */
export function UnderlineTabIndicator({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Indicator>) {
  return (
    <TabsPrimitive.Indicator
      className={cn(
        'absolute bottom-0 h-0.5 rounded-full bg-accent transition-all duration-200 ease-out',
        'left-[var(--active-tab-left)] w-[var(--active-tab-width)]',
        className
      )}
      {...props}
    />
  );
}

/** Flush-bordered tabs: the active item is underlined by a line that slides between tabs. */
// eslint-disable-next-line react-refresh/only-export-components
export const UnderlineTab = {
  Root: TabsPrimitive.Root,
  List: UnderlineTabList,
  Item: UnderlineTabItem,
  Indicator: UnderlineTabIndicator,
  Panel: TabPanel
};
