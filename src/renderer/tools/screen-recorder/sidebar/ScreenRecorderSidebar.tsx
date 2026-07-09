import React, { useRef, useState } from 'react';
import { Play, Plus } from 'lucide-react';
import { useLayoutStore } from '../../../src/store/layout.store';
import { useAppStore } from '../app/app-store';
import { useRecordingStore } from '../features/recording/store/recording-store';
import { AudioSourceToggle } from '../features/recording/components/AudioSourceToggle';
import { WebcamShapePicker } from '../features/webcam/components/WebcamShapePicker';
import {
  startCapture,
  fileExtensionForBlob,
  type CaptureHandle
} from '../features/recording/engine/capture-engine';

export const ScreenRecorderSidebar: React.FC = () => {
  const { openTab, activeInstanceId } = useLayoutStore();
  const selectedSource = useRecordingStore((state) => state.selectedSource);
  const audio = useRecordingStore((state) => state.audio);
  const route = useAppStore((state) => state.route);
  const isRecording = useAppStore((state) => state.isRecording);
  const setIsRecording = useAppStore((state) => state.setIsRecording);
  const setRoute = useAppStore((state) => state.setRoute);
  const setLastRecording = useAppStore((state) => state.setLastRecording);

  const [error, setError] = useState<string | null>(null);
  const captureRef = useRef<CaptureHandle | null>(null);

  function handleNewScreenRecorderSession(): void {
    const sessionId = `screenrecorder-session-${Date.now()}`;
    openTab({
      id: sessionId,
      title: 'Screen Recording',
      type: 'screenrecorder',
      instanceId: activeInstanceId
    });
  }

  async function handleStart(): Promise<void> {
    if (!selectedSource) {
      setError('Pick a screen or window first.');
      return;
    }
    setError(null);
    try {
      captureRef.current = await startCapture({ source: selectedSource, audio });
      setIsRecording(true);
    } catch (err) {
      // Most likely cause: the user denied the (rare, OS-level) permission
      // prompt, or no capture source is actually available.
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleStop(): Promise<void> {
    const capture = captureRef.current;
    if (!capture) return;
    setIsRecording(false);

    const blob = await capture.stop();
    captureRef.current = null;

    const previewUrl = URL.createObjectURL(blob);
    const extension = fileExtensionForBlob(blob);
    const fileName = `recording-${Date.now()}.${extension}`;

    let filePath: string | null = null;
    try {
      const arrayBuffer = await blob.arrayBuffer();
      filePath = await window.screenRecorder.recording.saveFile(fileName, arrayBuffer);
    } catch (err) {
      console.error('[ScreenRecorderSidebar] failed to save recording to disk:', err);
    }

    setLastRecording({ previewUrl, filePath, sizeBytes: blob.size, createdAt: Date.now() });
    setRoute('editor');
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
          ScreenRecorder
        </span>
        <button
          onClick={handleNewScreenRecorderSession}
          title="New Session"
          className="p-1 text-zinc-400 hover:text-white hover:bg-border-dark/60 rounded cursor-pointer transition-colors"
        >
          <Plus size={16} />
        </button>
      </div>

      <button
        onClick={handleNewScreenRecorderSession}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-editor-bg border border-border-dark hover:bg-border-dark/50 rounded text-xs text-zinc-300 hover:text-white cursor-pointer transition-all"
      >
        <Play size={12} className="text-zinc-500" />
        <span>Launch Studio</span>
      </button>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-bold text-zinc-500 uppercase">Audio</span>
        <AudioSourceToggle />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-bold text-zinc-500 uppercase">Webcam</span>
        <WebcamShapePicker />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="mt-1 border-t border-border-dark pt-3">
        {isRecording ? (
          <button
            onClick={handleStop}
            className="flex w-full items-center justify-center gap-1.5 rounded py-1.5 text-xs font-medium text-zinc-200 bg-editor-bg border border-border-dark hover:bg-border-dark/50 cursor-pointer transition-all"
          >
            Stop Recording
          </button>
        ) : (
          <button
            onClick={handleStart}
            disabled={!selectedSource || route !== 'record-setup'}
            title={
              route !== 'record-setup' ? 'Go to New Recording to start a recording' : undefined
            }
            className="flex w-full items-center justify-center gap-1.5 rounded py-1.5 text-xs font-medium text-white bg-accent hover:brightness-110 cursor-pointer transition-all disabled:pointer-events-none disabled:opacity-40"
          >
            Start Recording
          </button>
        )}
      </div>
    </div>
  );
};
