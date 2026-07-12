import { useEffect, useMemo, useState } from 'react';
import type { CaptureSource } from '@screen-recorder/types/recording';

const PRELOAD_MISSING_ERROR =
  'Capture API unavailable (preload script did not load). Check the console.';

export type SourceTab = 'screen' | 'window';

interface UseCaptureSourcesResult {
  sources: CaptureSource[];
  screens: CaptureSource[];
  windows: CaptureSource[];
  activeTab: SourceTab;
  setActiveTab: (tab: SourceTab) => void;
  loading: boolean;
}

export function useCaptureSources(
  onSelectSource: (source: CaptureSource | null) => void,
  options?: { enabled?: boolean }
): UseCaptureSourcesResult {
  const enabled = options?.enabled ?? true;
  const [sources, setSources] = useState<CaptureSource[]>([]);
  const [loading, setLoading] = useState(() => enabled && Boolean(window.screenRecorder));
  const [activeTab, setActiveTab] = useState<SourceTab>('screen');

  const screens = useMemo(() => sources.filter((source) => source.type === 'screen'), [sources]);
  const windows = useMemo(() => sources.filter((source) => source.type === 'window'), [sources]);

  useEffect(() => {
    if (!enabled) return;

    if (!window.screenRecorder) {
      console.error(PRELOAD_MISSING_ERROR);
      return;
    }

    window.screenRecorder.recording
      .getCaptureSources()
      .then((next) => {
        setSources(next);
        const nextScreens = next.filter((source) => source.type === 'screen');
        const nextWindows = next.filter((source) => source.type === 'window');
        const defaultTab: SourceTab = nextScreens.length > 0 ? 'screen' : 'window';
        setActiveTab(defaultTab);
        const defaultSource = defaultTab === 'screen' ? nextScreens[0] : nextWindows[0];
        if (defaultSource) onSelectSource(defaultSource);
      })
      .catch(() => {
        // Permission denied or picker dismissed — permission banner is enough.
        setSources([]);
        onSelectSource(null);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { sources, screens, windows, activeTab, setActiveTab, loading };
}
