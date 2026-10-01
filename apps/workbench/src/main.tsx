import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Tailwind, and with it the palette from packages/design-tokens. One import, and
// nothing in this package defines a colour of its own.
import './styles/app.css';
// The workbench's own reading of that palette, which does name colours and says
// why in its own header. Imported after `app.css`, so it lands after the
// generated theme, and its rules are unlayered so they win without depending on
// that order alone.
import './styles/palette.css';

import { App } from './App';
import { redirectMoved } from './router';

// Before anything renders, and before the shell reads the address: an address
// this site has moved is answered here, so `/workbench` and `/preview.html` reach
// `/preview` with its query and hash intact. See `MOVED` in `router.tsx`.
redirectMoved();

const root = document.getElementById('root');
if (!root) throw new Error('index.html has no #root');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
