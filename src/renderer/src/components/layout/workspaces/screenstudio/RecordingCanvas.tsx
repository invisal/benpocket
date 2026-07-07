import React from 'react';
import { Monitor } from 'lucide-react';

interface RecordingCanvasProps {
  isRecording: boolean;
  setIsRecording: (rec: boolean) => void;
  studioBackground: string;
}

export const RecordingCanvas: React.FC<RecordingCanvasProps> = ({
  isRecording,
  setIsRecording,
  studioBackground
}) => {
  return (
    <div className="flex-1 bg-sidebar-bg border border-border-dark rounded-lg overflow-hidden flex flex-col min-h-0">
      <div className="bg-editor-bg border-b border-border-dark px-3 py-2 flex items-center justify-between text-xs shrink-0 select-none">
        <span className="text-zinc-550 font-bold uppercase tracking-wider text-[10px]">
          Recording Session Canvas
        </span>
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isRecording ? 'bg-red-500 animate-pulse' : 'bg-border-dark'
            }`}
          />
          <span className="text-[10px] text-zinc-400">
            {isRecording ? 'RECORDING ACTIVE' : 'STUDIO READY'}
          </span>
        </div>
      </div>

      {/* Mock Screen Video Stream */}
      <div
        className={`flex-1 flex flex-col items-center justify-center p-6 ${
          studioBackground === 'violet'
            ? 'bg-gradient-to-tr from-purple-950/20 via-sidebar-bg to-violet-950/20'
            : 'bg-gradient-to-tr from-cyan-950/20 via-sidebar-bg to-editor-bg'
        }`}
      >
        <div className="relative w-full max-w-sm aspect-video bg-editor-bg border border-border-dark rounded-lg shadow-2xl overflow-hidden flex flex-col items-center justify-center p-4">
          {/* Mock browser layout */}
          <div className="absolute top-0 left-0 w-full h-5 bg-sidebar-bg border-b border-border-dark flex items-center px-2 gap-1 select-none">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500/80" />
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500/80" />
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
            <div className="w-24 h-3 bg-editor-bg rounded mx-auto border border-border-dark" />
          </div>
          <Monitor size={48} className="text-zinc-800" />
          <span className="text-[9px] text-zinc-650 mt-2 font-mono">
            Mock Output Display (Aspect Ratio 16:9)
          </span>

          {isRecording && (
            <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-red-600 text-[#fff] rounded text-[9px] font-bold tracking-widest">
              REC
            </div>
          )}
        </div>
      </div>

      {/* Capture controls */}
      <div className="bg-editor-bg border-t border-border-dark p-3 flex justify-center gap-3 shrink-0 select-none">
        <button
          onClick={() => setIsRecording(!isRecording)}
          className={`px-6 py-1.5 text-xs font-semibold rounded cursor-pointer transition-all ${
            isRecording
              ? 'bg-red-600 hover:bg-red-500 text-[#fff] shadow-lg shadow-red-900/10'
              : 'bg-accent/80 hover:bg-accent text-[#fff]'
          }`}
        >
          {isRecording ? 'Stop Recording' : 'Start Studio Capture'}
        </button>
      </div>
    </div>
  );
};
