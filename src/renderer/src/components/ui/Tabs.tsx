import { Tabs as TabsPrimitive } from '@base-ui/react';
import { cn } from 'cnfast';
import { type ComponentProps } from 'react';

export function TabPanel({ className, ...props }: ComponentProps<typeof TabsPrimitive.Panel>) {
  return <TabsPrimitive.Panel className={cn('outline-none', className)} {...props} />;
}

export function PillTabList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        'relative h-8 inline-flex items-center gap-1 rounded border border-border bg-surface-2 p-1',
        className
      )}
      {...props}
    />
  );
}

export function PillTabItem({ className, ...props }: ComponentProps<typeof TabsPrimitive.Tab>) {
  return (
    <TabsPrimitive.Tab
      className={cn(
        'relative z-10 flex items-center gap-1.5 px-2 h-6 text-xs cursor-pointer outline-none transition-colors',
        'text-muted-foreground hover:text-foreground font-medium',
        'data-[active]:text-strong',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
      {...props}
    />
  );
}

/** Sliding pill — render as a child of `PillTab.List`, alongside the items. */
export function PillTabIndicator({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Indicator>) {
  return (
    <TabsPrimitive.Indicator
      className={cn(
        // bg-surface-3 on a bg-surface-2 track only differs by 8/255 in dark mode - close enough
        // to invisible that the active tab reads as unmarked. Accent tint keeps real contrast in
        // both themes instead of relying on two adjacent surface shades.
        'absolute rounded-sm bg-accent/20 transition-all duration-200 ease-out border border-accent/30',
        'left-[var(--active-tab-left)] top-[var(--active-tab-top)]',
        'h-[var(--active-tab-height)] w-[var(--active-tab-width)]',
        className
      )}
      {...props}
    />
  );
}

/** Pill-style tabs: enclosed in a bordered track, with a pill that slides to the active tab. */
// eslint-disable-next-line react-refresh/only-export-components
export const PillTab = {
  Root: TabsPrimitive.Root,
  List: PillTabList,
  Item: PillTabItem,
  Indicator: PillTabIndicator,
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
