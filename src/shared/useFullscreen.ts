import { useCallback, useEffect, useState } from 'react';

// Fullscreen for the whole workspace, so the canvas and the conversations expand together.
// The browser owns this state and can drop it without us (Escape, F11, switching tabs), so the
// document is the source of truth and our button only ever reflects it.
export type FullscreenState = { active: boolean; supported: boolean; toggle: () => void };

export function useFullscreen(): FullscreenState {
  const [active, setActive] = useState(false);

  useEffect(() => {
    function sync() { setActive(document.fullscreenElement !== null); }
    document.addEventListener('fullscreenchange', sync);
    return () => { document.removeEventListener('fullscreenchange', sync); };
  }, []);

  // Embedded frames and some mobile browsers refuse fullscreen outright; hide the control there
  // rather than offering a button that throws.
  const supported = typeof document !== 'undefined' && document.fullscreenEnabled;

  // A denied request rejects, and a user who declines the permission prompt is not an error.
  // Stable so a keyboard shortcut can depend on it without re-registering its listener each render.
  const toggle = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen().catch(() => {});
  }, []);

  return { active, supported, toggle };
}
