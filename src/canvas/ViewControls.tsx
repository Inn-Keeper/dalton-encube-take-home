import type { ReactNode } from 'react';
import type { CameraAction } from '../shared/types';
import type { FullscreenState } from '../shared/useFullscreen';

// Every control in the cluster shares one shape; only its label and width differ.
export const zoomButton = 'h-8 min-w-8 cursor-pointer rounded border-none bg-transparent text-lg text-[#52624d] transition-colors'
  + ' hover:bg-sage disabled:cursor-not-allowed disabled:opacity-45'
  + ' focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#416d54]';

type Props = {
  zoom: number;
  disabled?: boolean;
  onAction: (kind: CameraAction['kind']) => void;
  /** Anything belonging to one view only, such as fullscreen on the canvas. */
  children?: ReactNode;
};

/** The zoom cluster, shared by the canvas and the inspector so both zoom by the same means and read
 *  the same way. Native titles cost nothing, and every control also carries a label for the keyboard
 *  and screen-reader paths a hover tooltip never reaches. */
export function ViewControls({ zoom, disabled = false, onAction, children }: Props) {
  return <div className="pointer-events-auto flex items-center rounded-lg border border-[#dfe3d7] bg-surface p-1 shadow-[0_2px_7px_#253b3308]" role="group" aria-label="Canvas navigation">
    <button className={zoomButton} disabled={disabled} title="Zoom out (−)" aria-label="Zoom out" onClick={() => onAction('out')}>−</button>
    <output className="min-w-[47px] text-center text-xs tabular-nums text-[#4f5e48]" title="Scale at the review plane" aria-label="Zoom level">{zoom}%</output>
    <button className={zoomButton} disabled={disabled} title="Zoom in (+)" aria-label="Zoom in" onClick={() => onAction('in')}>+</button>
    <span className="mx-1 h-4 w-px bg-[#e0e4d8]" />
    <button className={`${zoomButton} whitespace-nowrap px-[9px] text-xs`} disabled={disabled} title="Return to the starting framing (R)" aria-keyshortcuts="r" aria-label="Reset view" onClick={() => onAction('reset')}>Reset view <span aria-hidden="true" className="pl-1.5 text-xs">↗</span></button>
    {children}
  </div>;
}

/** Fullscreen sits in the same cluster in both views, so it lives with the cluster. Not gated on
 *  WebGL: the fallback still has conversations worth filling the screen with. */
export function FullscreenButton({ state }: { state: FullscreenState }) {
  if (!state.supported) return null;
  return <>
    <span className="mx-1 h-4 w-px bg-[#e0e4d8]" />
    <button
      type="button"
      className={`${zoomButton} grid place-items-center`}
      title={state.active ? 'Leave fullscreen (F)' : 'Fill the screen with the canvas and conversations (F)'}
      aria-keyshortcuts="f"
      aria-label="Fullscreen"
      aria-pressed={state.active}
      onClick={state.toggle}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4 fill-none stroke-current stroke-[1.5] [stroke-linecap:round]">
        {state.active
          ? <path d="M6.5 2v4.5H2M9.5 2v4.5H14M6.5 14V9.5H2M9.5 14V9.5H14" />
          : <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" />}
      </svg>
    </button>
  </>;
}
