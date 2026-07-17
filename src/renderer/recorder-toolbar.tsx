import './src/assets/main.css';
import '@screen-recorder/windows/recorder-toolbar.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RecorderToolbarApp } from '@screen-recorder/windows/RecorderToolbarApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RecorderToolbarApp />
  </StrictMode>
);
