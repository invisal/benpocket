import React, { useState } from 'react';
import { RecordingCanvas } from './screenstudio/RecordingCanvas';
import { StudioEngineConfig } from './screenstudio/StudioEngineConfig';

export const ScreenStudioWorkspace: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [zoomSpeed, setZoomSpeed] = useState(40);
  const [studioBackground, setStudioBackground] = useState('violet');

  return (
    <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
      <RecordingCanvas
        isRecording={isRecording}
        setIsRecording={setIsRecording}
        studioBackground={studioBackground}
      />
      <StudioEngineConfig
        zoomSpeed={zoomSpeed}
        setZoomSpeed={setZoomSpeed}
        studioBackground={studioBackground}
        setStudioBackground={setStudioBackground}
      />
    </div>
  );
};
