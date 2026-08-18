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
  className?: string;
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
}
