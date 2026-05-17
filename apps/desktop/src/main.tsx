import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './shared/i18n/i18n';
import './shared/styles/tokens.css';
import './shared/styles/global.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
