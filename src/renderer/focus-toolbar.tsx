import './src/assets/main.css';
import './focus-toolbar/toolbar.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FocusToolbarApp } from './focus-toolbar/FocusToolbarApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FocusToolbarApp />
  </StrictMode>
);
