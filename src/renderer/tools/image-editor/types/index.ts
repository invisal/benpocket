export type ImageToolId =
  | 'preview'
  | 'generative'
  | 'resize'
  | 'crop'
  | 'context-resize'
  | 'context-removal'
  | 'upscale'
  | 'bg-remove';

export interface ImageToolProps {
  /** Raw encoded image bytes (the format named by `mimeType`). */
  binary: Uint8Array<ArrayBuffer>;
  /** Must be one of the encodable types this component supports: image/png, image/jpeg, image/webp. */
  mimeType: string;
  /** Called with the newly re-encoded bytes (same `mimeType`) every time an edit is applied. */
  onChange: (binary: Uint8Array<ArrayBuffer>) => void;
  /** Which panel to show. Controlled by the caller so the tool picker can live in the caller's own
   * toolbar (alongside e.g. a Save button) instead of a separate one nested inside `ImageTool`. */
  tool: ImageToolId;
  /** Setter for `tool`, handed to the caller's own picker UI. `ImageTool` never calls this itself. */
  onToolChange: (tool: ImageToolId) => void;
  /** Reports the decoded image's pixel size and current zoom level, so the caller can render a
   * readout (e.g. next to the tool picker) without decoding the image itself. `null` while loading
   * or on decode error. */
  onViewChange?: (view: ImageViewInfo | null) => void;
  className?: string;
}

export interface ImageViewInfo {
  width: number;
  height: number;
  zoom: number;
}

/** Extensions ImageTool can decode, edit, and re-encode without lossy format changes. */
export const EDITABLE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Every tool's props, uniform: `imageData` for display/math, `binary` (the current compressed
 * bytes -- same one `imageData` was decoded from) for tools that run through sharp, and `onCommit`
 * which every tool calls with the new compressed bytes once its edit produces them. `ImageTool`
 * owns exactly one `useState` for `binary`; `imageData` is purely derived from it via a single
 * decode effect, so there's one source of truth instead of two fields kept in sync by hand.
 */
export interface ToolPanelProps {
  imageData: ImageData;
  binary: Uint8Array<ArrayBuffer>;
  mimeType: string;
  onCommit: (newBinary: Uint8Array<ArrayBuffer>) => void;
  /** `null` = auto-fit to the container, recomputed whenever the container resizes (like Windows
   * Photos' default view). A number = manual zoom, an absolute multiple of native pixel size (1 =
   * 100%) that stays fixed across container resizes. Owned by `ImageTool` so it survives switching
   * between tools. */
  zoom: number | null;
  onZoomChange: (zoom: number | null) => void;
  /** The zoom actually on screen right now: the auto-fit scale while `zoom` is `null`, or `zoom`
   * itself otherwise. Since the fit scale depends on the container's measured size, only
   * `ImageCanvas` knows it -- this reports it back up for a "current zoom %" readout. */
  onEffectiveZoomChange: (effectiveZoom: number) => void;
  /** Canvas pan offset in unscaled screen pixels. Also owned by `ImageTool` for the same reason. */
  pan: { x: number; y: number };
  onPanChange: (pan: { x: number; y: number }) => void;
}
