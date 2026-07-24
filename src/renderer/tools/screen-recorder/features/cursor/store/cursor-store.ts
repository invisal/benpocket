import { create } from 'zustand';
import type { CursorSettings } from '@screen-recorder/types/project';
import { DEFAULT_CURSOR_STYLE_ID } from '@shared/cursor-styles';
import { withHistory } from '../../history/lib/with-history';

interface CursorStoreState extends CursorSettings {
  setVisible: (visible: boolean) => void;
  setClipToCanvas: (clipToCanvas: boolean) => void;
  setStyle: (style: string) => void;
  setSize: (size: number) => void;
  setSmoothing: (smoothing: number) => void;
  setMotionBlur: (motionBlur: number) => void;
  setClickBounce: (clickBounce: number) => void;
}

export const useCursorStore = create<CursorStoreState>(
  withHistory(
    'cursor',
    (s) => ({
      visible: s.visible,
      clipToCanvas: s.clipToCanvas,
      style: s.style,
      size: s.size,
      smoothing: s.smoothing,
      motionBlur: s.motionBlur,
      clickBounce: s.clickBounce
    }),
    (set) => ({
      visible: true,
      clipToCanvas: false,
      style: DEFAULT_CURSOR_STYLE_ID,
      size: 4.5,
      smoothing: 0.67,
      motionBlur: 0,
      clickBounce: 2.5,
      setVisible: (visible) => set({ visible }),
      setClipToCanvas: (clipToCanvas) => set({ clipToCanvas }),
      setStyle: (style) => set({ style }),
      setSize: (size) => set({ size }),
      setSmoothing: (smoothing) => set({ smoothing }),
      setMotionBlur: (motionBlur) => set({ motionBlur }),
      setClickBounce: (clickBounce) => set({ clickBounce })
    })
  )
);
