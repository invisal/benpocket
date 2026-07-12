import type { ScreenRect } from './capture-region';

/** Source the user chose in the PipeWire portal. */
export interface OsPickerSource {
  id: string;
  type: 'screen' | 'window';
  displayId?: string;
  /** Matched monitor bounds in Electron screen coordinates (DIP). */
  displayBounds?: ScreenRect;
  scaleFactor?: number;
}
