// Frameless window -- dragging is opted into via CSS, not a titlebar. DRAG
// goes on the pill; interactive elements need NO_DRAG or clicks become
// window-drags.
export const DRAG = '[-webkit-app-region:drag]';
export const NO_DRAG = '[-webkit-app-region:no-drag]';

// onMouseEnter only, never onMouseLeave: a drag gesture fires a synthetic
// mouseleave that would kill the drag mid-move if this ran on it.
export function enablePointerEvents(): void {
  void window.screenRecorder.window.setIgnoreMouseEvents(false);
}
export function disablePointerEvents(): void {
  void window.screenRecorder.window.setIgnoreMouseEvents(true);
}
