import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { REFERENCE_CANVAS_WIDTH } from '@shared/constants';
import { beginGesture, endGesture } from '../../../features/history/store/history-store';

interface WebcamPosition {
  x: number;
  y: number;
}

interface UseWebcamDragOptions {
  stageRef: RefObject<HTMLDivElement | null>;
  position: WebcamPosition;
  setPosition: (position: WebcamPosition) => void;
}

interface UseWebcamDragResult {
  startWebcamDrag: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

export function useWebcamDrag({
  stageRef,
  position,
  setPosition
}: UseWebcamDragOptions): UseWebcamDragResult {
  const dragState = useRef<{
    startClientX: number;
    startClientY: number;
    startPos: WebcamPosition;
  } | null>(null);

  function handleWebcamDrag(event: PointerEvent): void {
    const drag = dragState.current;
    const stage = stageRef.current;
    if (!drag || !stage) return;
    const scale = stage.getBoundingClientRect().width / REFERENCE_CANVAS_WIDTH;
    const dx = (event.clientX - drag.startClientX) / scale;
    const dy = (event.clientY - drag.startClientY) / scale;
    setPosition({
      x: Math.round(drag.startPos.x + dx),
      y: Math.round(drag.startPos.y + dy)
    });
  }

  function stopWebcamDrag(): void {
    if (dragState.current) endGesture();
    dragState.current = null;
    window.removeEventListener('pointermove', handleWebcamDrag);
  }

  function startWebcamDrag(event: ReactPointerEvent<HTMLDivElement>): void {
    event.preventDefault();
    beginGesture();
    dragState.current = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPos: position
    };
    window.addEventListener('pointermove', handleWebcamDrag);
    window.addEventListener('pointerup', stopWebcamDrag, { once: true });
  }

  useEffect(() => {
    return () => {
      if (dragState.current) endGesture();
    };
  }, []);

  return { startWebcamDrag };
}
