import './src/assets/main.css';
import './tools/screen-capture/windows/capture-toolbar.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CaptureToolbarApp } from './tools/screen-capture/windows/CaptureToolbarApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CaptureToolbarApp />
  </StrictMode>
);
