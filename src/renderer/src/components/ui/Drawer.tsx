import { Drawer as DrawerPrimitive } from '@base-ui/react';
import { cn } from 'cnfast';
import { X } from 'lucide-react';
import { type ComponentProps } from 'react';

export function DrawerBackdrop({
  className,
  ...props
}: ComponentProps<typeof DrawerPrimitive.Backdrop>) {
  return (
    <DrawerPrimitive.Backdrop
      className={cn(
        // top-8 keeps the app's custom titlebar (h-8) clear of the backdrop
        // so window controls stay usable while the drawer is open.
        'fixed top-8 inset-x-0 bottom-0 z-50',
        'transition-opacity',
        'data-[starting-style]:opacity-0',
        'data-[ending-style]:opacity-0',
        className
      )}
      {...props}
    />
  );
}

// top-8 / h-[calc(100%-2rem)] keeps the app's custom titlebar (h-8) clear of
// the panel so window controls stay usable while the drawer is open. `bottom`
// is already anchored to the viewport's bottom edge, so it's unaffected.
const DRAWER_SIDE_CLASSNAMES = {
  right: cn(
    'top-10 right-2 bottom-10',
    'data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full'
  ),
  left: cn(
    'top-8 left-0 h-[calc(100%-2rem)] w-80 border-r',
    'data-[starting-style]:-translate-x-full data-[ending-style]:-translate-x-full'
  ),
  top: cn(
    'top-8 inset-x-0 h-80 border-b',
    'data-[starting-style]:-translate-y-full data-[ending-style]:-translate-y-full'
  ),
  bottom: cn(
    'bottom-0 inset-x-0 h-80 border-t',
    'data-[starting-style]:translate-y-full data-[ending-style]:translate-y-full'
  )
};

export function DrawerContent({
  className,
  backdropClassName,
  children,
  showClose = true,
  side = 'right',
  ...props
}: ComponentProps<typeof DrawerPrimitive.Popup> & {
  showClose?: boolean;
  /** Which edge the drawer slides in from. */
  side?: keyof typeof DRAWER_SIDE_CLASSNAMES;
  /** Extra classes for the backdrop. */
  backdropClassName?: string;
}) {
  return (
    <DrawerPrimitive.Portal>
      <DrawerBackdrop className={backdropClassName} />
      <DrawerPrimitive.Popup
        className={cn(
          'fixed overflow-hidden w-md z-50 bg-surface-2 shadow-lg p-1',
          'border border-border-dark dark:border-zinc-700 rounded-lg',
          'transition-transform',
          DRAWER_SIDE_CLASSNAMES[side],
          className
        )}
        {...props}
      >
        <div className="h-full w-full bg-surface border border-gray-300 dark:border-zinc-700 rounded shadow">
          {children}
          {showClose && (
            <DrawerPrimitive.Close className="absolute top-3 right-3 flex size-6 items-center justify-center rounded-sm text-text-dim outline-none hover:bg-border-dark/60 hover:text-text-base">
              <X className="size-3.5" />
            </DrawerPrimitive.Close>
          )}
        </div>
      </DrawerPrimitive.Popup>
    </DrawerPrimitive.Portal>
  );
}

export function DrawerTitle({ className, ...props }: ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      className={cn('text-[15px] font-medium text-text-base', className)}
      {...props}
    />
  );
}

export function DrawerDescription({
  className,
  ...props
}: ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      className={cn('mt-1 text-[13px] text-text-dim', className)}
      {...props}
    />
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const Drawer = {
  Root: DrawerPrimitive.Root,
  Trigger: DrawerPrimitive.Trigger,
  Content: DrawerContent,
  Title: DrawerTitle,
  Description: DrawerDescription,
  Close: DrawerPrimitive.Close
};
