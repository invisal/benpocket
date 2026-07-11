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
  error: string | null;
}

export function useCaptureSources(
  onSelectSource: (source: CaptureSource | null) => void
): UseCaptureSourcesResult {
  const [sources, setSources] = useState<CaptureSource[]>([]);
  const [error, setError] = useState<string | null>(() =>
    window.screenRecorder ? null : PRELOAD_MISSING_ERROR
  );
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SourceTab>('screen');

  const screens = useMemo(() => sources.filter((source) => source.type === 'screen'), [sources]);
  const windows = useMemo(() => sources.filter((source) => source.type === 'window'), [sources]);

  useEffect(() => {
    if (!window.screenRecorder) return;

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
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { sources, screens, windows, activeTab, setActiveTab, loading, error };
}
