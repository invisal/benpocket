import './src/assets/main.css';
import '@screen-recorder/windows/overlay.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SourcePickerOverlayApp } from '@screen-recorder/windows/SourcePickerOverlayApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SourcePickerOverlayApp />
  </StrictMode>
);
