import { useCallback, useEffect, useState } from 'react';

// Fullscreen for the whole workspace, so the canvas and the conversations expand together.
// The browser owns this state and can drop it without us (Escape, F11, switching tabs), so the
// document is the source of truth and our button only ever reflects it.
export type FullscreenState = { active: boolean; nativeSupported: boolean; supported: boolean; toggle: () => void };

export function useFullscreen(): FullscreenState {
  const [nativeActive, setNativeActive] = useState(false);
  const [focusActive, setFocusActive] = useState(false);
  const nativeSupported = typeof document !== 'undefined' && document.fullscreenEnabled;

  useEffect(() => {
    function sync() { setNativeActive(document.fullscreenElement !== null); }
    document.addEventListener('fullscreenchange', sync);
    return () => { document.removeEventListener('fullscreenchange', sync); };
  }, []);

  useEffect(() => {
    if (!focusActive) return;
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') setFocusActive(false);
    }
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('keydown', escape); };
  }, [focusActive]);

  // A denied request rejects, and a user who declines the permission prompt is not an error.
  // Stable so a keyboard shortcut can depend on it without re-registering its listener each render.
  const toggle = useCallback(() => {
    if (!nativeSupported) return setFocusActive((current) => !current);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen().catch(() => {});
  }, [nativeSupported]);

  return { active: nativeActive || focusActive, nativeSupported, supported: true, toggle };
}
