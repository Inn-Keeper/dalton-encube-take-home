import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// Self-hosted rather than a CDN, and the weight axis only: no italic is used anywhere. The type was
// drawn against Inter's metrics, so leaving it to a system fallback changes the design per platform.
import '@fontsource-variable/inter/wght.css';
import './index.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
