import { Tabs as TabsPrimitive } from '@base-ui/react';
import { cn } from 'cnfast';
import { type ComponentProps } from 'react';

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn('flex border-b border-line', className)} {...props} />;
}

export function TabsTab({ className, ...props }: ComponentProps<typeof TabsPrimitive.Tab>) {
  return (
    <TabsPrimitive.Tab
      className={cn(
        '-mb-px cursor-pointer border-b-2 border-transparent px-3 py-1.5 text-xs font-medium text-text-dim outline-none transition-colors',
        'hover:text-text-base',
        'data-[active]:border-accent data-[active]:text-accent',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
      {...props}
    />
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const Tabs = {
  Root: TabsPrimitive.Root,
  List: TabsList,
  Tab: TabsTab
};
