import { useEffect, useEffectEvent } from 'react';
import { normalizeCaptureDelay } from '@shared/capture-delay';
import { useToolTabs } from './providers/ToolProvider';
import { useCaptureResultStore } from '../../tools/screen-capture/store/capture-result.store';
import { useScreenCaptureSettings } from '../../tools/screen-capture/lib/use-screen-capture-settings';
import {
  captureFromSource,
  captureSelectedRegion
} from '../../tools/screen-capture/lib/capture-frame';

/**
 * Always-mounted: hidden screen-capture tabs tear down effects via Activity,
 * so captureFromSource must run here (owner renderer) -- screenshot.capture
 * hides event.sender, which has to be the main window, not the pill.
 */
export function CaptureToolbarBridge(): null {
  const { tabs, openTab, selectTab } = useToolTabs();
  const { setFields } = useScreenCaptureSettings();

  const focusOrOpenScreenCapture = useEffectEvent((): void => {
    const existing = tabs.find((t) => t.type === 'screen-capture');
    if (existing) {
      selectTab(existing.id);
      return;
    }
    openTab('screen-capture', {});
  });

  useEffect(() => {
    void window.screenRecorder.captureToolbar.isSessionActive().then((active) => {
      useCaptureResultStore.getState().setToolbarOpen(active);
    });

    const unsubscribeClosed = window.screenRecorder.captureToolbar.onClosed(() => {
      useCaptureResultStore.getState().setToolbarOpen(false);
    });

    const unsubscribeDelay = window.screenRecorder.captureToolbar.onDelayChanged((delaySeconds) => {
      setFields({ delaySeconds: normalizeCaptureDelay(delaySeconds) });
    });

    const unsubscribeCapture = window.screenRecorder.captureToolbar.onCaptureRequested(
      async (payload) => {
        try {
          // No thumbnail rendered here -- skip the expensive per-source encode.
          const sources = await window.screenRecorder.recording.getCaptureSources({
            includeThumbnails: false
          });
          const source = sources.find((s) => s.id === payload.sourceId);
          let blob: Blob | null = null;
          if (payload.cropRegion) {
            blob = await captureSelectedRegion(sources, payload.cropRegion, { hideApp: false });
          } else if (source) {
            blob = await captureFromSource(source, { hideApp: false });
          }
          if (blob) useCaptureResultStore.getState().setPending(blob);
        } catch (err) {
          console.error('Could not capture.', err);
        } finally {
          window.screenRecorder.captureToolbar.reportCaptured();
          focusOrOpenScreenCapture();
        }
      }
    );

    return () => {
      unsubscribeClosed();
      unsubscribeDelay();
      unsubscribeCapture();
    };
  }, [setFields]);

  return null;
}
