import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { PreviewVideoController } from '@screen-recorder/types/editor';
import { useAppStore } from '../../../app/app-store';
import {
  useTimelineStore,
  MIN_TIMELINE_ZOOM,
  MAX_TIMELINE_ZOOM
} from '../../../features/timeline/store/timeline-store';

// ~1 frame at 30fps -- there's no source framerate available here, so this is
// a reasonable fixed approximation rather than a true frame-accurate step.
const FRAME_STEP_SEC = 1 / 30;
const JUMP_STEP_SEC = 1;
const TIMELINE_ZOOM_STEP = 0.5;

interface UseEditorKeyboardShortcutsOptions {
  videoRef: RefObject<PreviewVideoController | null>;
  undo: () => void;
  redo: () => void;
}

/**
 * Every editor keyboard shortcut lives in this one hook -- playback,
 * scrubbing, the cut/zoom tools, undo/redo, and save -- rather than spread
 * across separate hooks/components, so there's one place to check for
 * conflicts between bindings. Reads/writes `useTimelineStore` directly
 * rather than taking its state as props, matching how CutTimeline (rendered
 * independently of EditorPage) already shares this same state -- see
 * timeline-store.ts's doc comments on `activeTool`/`isCutToolActive`.
 */
export function useEditorKeyboardShortcuts({
  videoRef,
  undo,
  redo
}: UseEditorKeyboardShortcutsOptions): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      const target = event.target as HTMLElement | null;
      const isEditingText =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (isEditingText) return;

      // Cmd/Ctrl-modified bindings (undo/redo/save) first, and returned
      // from immediately -- every binding below this is a bare key and must
      // never also fire while a modifier's held (e.g. Cmd+Z must not *also*
      // toggle the Zoom tool, which plain "z" does).
      if (event.metaKey || event.ctrlKey) {
        const key = event.key.toLowerCase();
        if (key === 'z' && !event.shiftKey) {
          event.preventDefault();
          undo();
        } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
          event.preventDefault();
          redo();
        } else if (key === 's') {
          event.preventDefault();
          // Delegates to ScreenRecorderApp's own `handleSaveClick` -- see
          // app-store.ts's `requestSave` doc for why this can't just call a
          // save function directly from here.
          useAppStore.getState().requestSave();
        }
        return;
      }
      // Leave every other OS/browser Alt-modified shortcut alone.
      if (event.altKey) return;

      const video = videoRef.current;
      const store = useTimelineStore.getState();

      switch (event.key) {
        case ' ': {
          if (!video) return;
          event.preventDefault();
          if (video.paused) video.play();
          else video.pause();
          return;
        }

        case 'Escape': {
          // Cascade: disarm the cut/zoom pointer tool first, then close the
          // open tool panel, then clear clip selection -- one Escape per step,
          // so it never discards more context than the single most-recent one.
          if (store.isCutToolActive || store.isZoomToolActive) {
            store.setCutToolActive(false);
            store.setZoomToolActive(false);
          } else if (store.activeTool) {
            store.setActiveTool(null);
          } else if (store.selectedSegmentId) {
            store.setSelectedSegmentId(null);
          }
          (document.activeElement as HTMLElement | null)?.blur();
          return;
        }

        case 'ArrowLeft':
        case 'ArrowRight': {
          if (!video) return;
          event.preventDefault();
          const step = event.shiftKey ? JUMP_STEP_SEC : FRAME_STEP_SEC;
          const delta = event.key === 'ArrowLeft' ? -step : step;
          video.currentTime = Math.min(Math.max(0, video.currentTime + delta), video.duration || 0);
          return;
        }

        case 'Home': {
          if (!video) return;
          event.preventDefault();
          video.currentTime = 0;
          return;
        }

        case 'End': {
          if (!video) return;
          event.preventDefault();
          video.currentTime = video.duration || 0;
          return;
        }

        case 'Delete':
        case 'Backspace': {
          if (!store.selectedSegmentId) return;
          event.preventDefault();
          store.deleteSegment(store.selectedSegmentId);
          return;
        }

        case 'c':
        case 'C': {
          event.preventDefault();
          store.setCutToolActive(!store.isCutToolActive);
          return;
        }

        case 'z':
        case 'Z': {
          event.preventDefault();
          store.setZoomToolActive(!store.isZoomToolActive);
          return;
        }

        case '=':
        case '+': {
          event.preventDefault();
          store.setTimelineZoom(
            Math.min(MAX_TIMELINE_ZOOM, store.timelineZoom + TIMELINE_ZOOM_STEP)
          );
          return;
        }

        case '-':
        case '_': {
          event.preventDefault();
          store.setTimelineZoom(
            Math.max(MIN_TIMELINE_ZOOM, store.timelineZoom - TIMELINE_ZOOM_STEP)
          );
          return;
        }

        default:
          return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [videoRef, undo, redo]);
}
