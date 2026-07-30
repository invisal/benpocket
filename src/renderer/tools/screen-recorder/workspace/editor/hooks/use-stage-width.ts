import { useEffect, useRef, useState, type RefObject } from 'react';

interface UseStageWidthResult {
  stageRef: RefObject<HTMLDivElement | null>;
  stageWidthPx: number;
}

export function useStageWidth(): UseStageWidthResult {
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageWidthPx, setStageWidthPx] = useState(0);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const borderBoxWidth = entries[0]?.borderBoxSize?.[0]?.inlineSize;
      setStageWidthPx(borderBoxWidth ?? el.getBoundingClientRect().width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { stageRef, stageWidthPx };
}
