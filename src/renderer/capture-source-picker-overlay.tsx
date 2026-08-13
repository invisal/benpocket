import './src/assets/main.css';
import '@screen-recorder/windows/overlay.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CaptureSourcePickerOverlayApp } from './tools/screen-capture/windows/CaptureSourcePickerOverlayApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CaptureSourcePickerOverlayApp />
  </StrictMode>
);
