import type React from 'react';
import type { ComponentProps } from 'react';
import { cn } from 'cnfast';
import { ResizablePanel } from './ResizablePanel';

interface LayoutFlexProps {
  /** Axis children are stacked along. Defaults differ between `Container` and `Content` -- see each. */
  direction?: 'row' | 'column';
  className?: string;
  children?: React.ReactNode;
}

/**
 * Outer flex region that a fixed-size `HorizontalPanel`/`VerticalPanel` and a fill `Content`
 * are placed side by side inside. Always fills its parent (`flex-1`) -- nest another `Container`
 * directly (as a sibling of the panel, not inside `Content`) to split an axis again. `Content` is
 * for an actual leaf pane, not a further split -- it carries its own card styling, and wrapping a
 * split in it would nest one card inside another.
 */
export function LayoutContainer({ direction = 'row', className, children }: LayoutFlexProps) {
  return (
    <div
      className={cn(
        'flex-1 flex min-h-0 min-w-0 bg-surface-3',
        direction === 'column' && 'flex-col',
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * The non-resizable region of a `Container` that fills whatever space its sibling
 * `HorizontalPanel`/`VerticalPanel` doesn't take. Defaults to stacking its own children
 * (e.g. a header above a body) -- pass `direction="row"` if it instead holds a row split.
 */
export function LayoutContent({ direction = 'column', className, children }: LayoutFlexProps) {
  return (
    <div
      className={cn(
        'bg-surface flex-1 flex min-h-0 min-w-0 rounded overflow-hidden',
        direction === 'column' && 'flex-col',
        className
      )}
    >
      {children}
    </div>
  );
}

type ResizablePanelProps = ComponentProps<typeof ResizablePanel>;

// The drag handle itself doubles as the 5px gutter between a panel and its sibling `Content` --
// it's kept visible (not just on hover) so the gutter and the draggable strip are the same
// element, rather than a dead CSS gap sitting next to a separate, hard-to-grab handle.
const HORIZONTAL_HANDLE_CLASS =
  'w-[5px] bg-surface-3 hover:bg-accent/30 active:bg-accent transition-colors z-40';
const VERTICAL_HANDLE_CLASS =
  'h-[5px] bg-surface-3 hover:bg-accent/30 active:bg-accent transition-colors z-40';

function renderLayoutPanel(
  handleClass: string,
  {
    className,
    handleClassName,
    ...props
  }: Omit<ResizablePanelProps, 'edge'> & { edge: ResizablePanelProps['edge'] }
) {
  return (
    <ResizablePanel
      {...props}
      className={cn('bg-surface rounded overflow-hidden', className)}
      handleClassName={cn(handleClass, handleClassName)}
    />
  );
}

/** A `ResizablePanel` arranged side-by-side with its sibling `Content` -- e.g. a left/right sidebar. */
export function LayoutHorizontalPanel(
  props: Omit<ResizablePanelProps, 'edge'> & { edge: 'left' | 'right' }
) {
  return renderLayoutPanel(HORIZONTAL_HANDLE_CLASS, props);
}

/** A `ResizablePanel` stacked above/below its sibling `Content` -- e.g. a bottom response panel. */
export function LayoutVerticalPanel(
  props: Omit<ResizablePanelProps, 'edge'> & { edge: 'top' | 'bottom' }
) {
  return renderLayoutPanel(VERTICAL_HANDLE_CLASS, props);
}

/**
 * Flex layout primitives for splitting a tool's workspace into a fill region plus one or more
 * resizable panels. `HorizontalPanel`/`VerticalPanel` are named for how the panel sits relative
 * to `Content` (side-by-side vs stacked), not the axis you drag along.
 *
 * ```tsx
 * <Layout.Container>
 *   <Layout.HorizontalPanel edge="right" size={sidebarWidth} onResize={setSidebarWidth} min={200} max={480}>
 *     <Sidebar />
 *   </Layout.HorizontalPanel>
 *   <Layout.Container direction="column">
 *     <Layout.Content>
 *       <Editor />
 *     </Layout.Content>
 *     <Layout.VerticalPanel edge="top" size={responseHeight} onResize={setResponseHeight} min={15} max={75} unit="%">
 *       <Response />
 *     </Layout.VerticalPanel>
 *   </Layout.Container>
 * </Layout.Container>
 * ```
 */
// eslint-disable-next-line react-refresh/only-export-components
export const Layout = {
  Container: LayoutContainer,
  Content: LayoutContent,
  HorizontalPanel: LayoutHorizontalPanel,
  VerticalPanel: LayoutVerticalPanel
};
