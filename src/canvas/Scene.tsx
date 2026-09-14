import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { Group, PCFShadowMap } from 'three';
import WebGL from 'three/addons/capabilities/WebGL.js';
import { CanvasControls } from './CanvasControls';
import { CommentPins } from './CommentPins';
import { SceneGrid } from './SceneGrid';
import { FullscreenButton, ViewControls } from './ViewControls';
import { StudyBadges } from './StudyBadges';
import { StudyViewer } from './StudyViewer';
import { Form, studies } from './studies';
import { Kbd } from '../shared/Kbd';
import { submitHint } from '../shared/ui';
import type { FullscreenState } from '../shared/useFullscreen';
import type { CameraAction, Draft, Mode, PinPosition, PlaneView, Thread } from '../shared/types';

type Props = {
  threads: Thread[]; selectedId: string | null; draft: Draft | null; mode: Mode;
  action: CameraAction | null; onPlace: (draft: Draft) => void; onSelect: (id: string) => void;
  onAction: (kind: CameraAction['kind']) => void;
  /** Owned by the workspace above, since fullscreen covers the conversations too, not just here. */
  fullscreen: FullscreenState;
};

// Four related sculptural studies make depth readable without model downloads or scene-editing features.
function DesignObjects({ objects }: { objects: React.RefObject<Group | null> }) {
  return <group ref={objects}>
    {studies.map((study) => <group key={study.id} position={[study.at[0], study.at[1], 0]}>
      <mesh position={[0, 0, -0.06]} receiveShadow>
        <boxGeometry args={[5.8, 3.8, 0.3]} /><meshStandardMaterial color={study.board} roughness={0.85} />
      </mesh>
      <group position={[0, 0, study.lift]}><Form study={study} /></group>
    </group>)}
  </group>;
}

// Compose the WebGL view and accessible overlays without putting form state in the render loop.
export function Scene({ threads, selectedId, draft, mode, action, onPlace, onSelect, onAction, fullscreen }: Props) {
  const [webglAvailable] = useState(WebGL.isWebGL2Available);
  const objects = useRef<Group>(null);
  const surface = useRef<HTMLDivElement>(null);
  const [pins, setPins] = useState<PinPosition[]>([]);
  const [badges, setBadges] = useState<PinPosition[]>([]);
  // Local to the canvas: inspecting a form changes nothing the rest of the workspace needs to know.
  const [inspecting, setInspecting] = useState<string | null>(null);
  const inspector = studies.find((study) => study.id === inspecting) ?? null;
  const lastInspected = useRef<string | null>(null);

  // Return the keyboard to the badge once the overlay is gone and its inert marking has lifted.
  // An effect, not the overlay's own cleanup, because that runs while the badge is still inert.
  useEffect(() => {
    if (inspecting) {
      lastInspected.current = inspecting;
      return;
    }
    const study = lastInspected.current;
    if (!study) return;
    lastInspected.current = null;
    // Next frame, and re-queried: closing the overlay resizes the canvas, which reprojects the
    // badges. Holding a reference from before that would point at an element React has replaced.
    const frame = requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>(`.study-badge[data-study="${study}"]`)?.focus({ preventScroll: true });
    });
    return () => { cancelAnimationFrame(frame); };
  }, [inspecting]);
  const [zoom, setZoom] = useState(100);
  const [plane, setPlane] = useState<PlaneView | null>(null);
  const [ready, setReady] = useState(false);

  // A stable callback keeps camera listeners intact when only their projected output changes.
  // The first projection also marks the surface ready, because gestures are dropped before then.
  const onView = useCallback((positions: PinPosition[], badgePositions: PinPosition[], percentage: number, view: PlaneView) => {
    setPins(positions);
    setBadges(badgePositions);
    setZoom(percentage);
    setPlane(view);
    setReady(true);
  }, []);

  // Each hint names what its key acts on right now. "Close with Esc" left the reader to guess what
  // would close, and a key with nothing to act on is not worth a line at all.
  const hints: ReactNode[] = [mode === 'comment'
    ? 'Click a form or empty space to comment · Drag to pan'
    : 'Drag or scroll to pan · Pinch to zoom'];
  if (draft) hints.push(<>Post with <Kbd>{submitHint}</Kbd></>, <>Discard the draft with <Kbd>Esc</Kbd></>);
  else if (selectedId) hints.push(<>Close the conversation with <Kbd>Esc</Kbd></>);
  else if (mode === 'pan') hints.push(<>Comment with <Kbd>C</Kbd></>);

  return <section
    className="canvas-viewport group relative flex min-h-0 flex-1 flex-col overflow-hidden overscroll-contain bg-canvas-deep"
    data-mode={mode}
    aria-label="3D review canvas"
  >
    {/* Absolute, never a flex sibling: a heading in flow would steal that strip from the drag surface. */}
    <div inert={inspector !== null} className="canvas-heading pointer-events-none absolute inset-x-0 top-0 z-10 px-gutter pt-3.5 pb-3 max-stack:px-gutter-tight max-stack:pt-1 max-stack:pb-2.5">
      <span className="text-2xs font-bold tracking-[2px] text-on-canvas-muted">EXPLORATION / 001</span>
      <h2 className="mt-2 mb-[5px] font-serif text-display font-normal tracking-[-.9px] text-on-canvas max-panel:text-2xl max-stack:hidden">Objects in conversation.</h2>
    </div>
    {/* Focusable and key-driven, so the canvas is operable without a pointer. role=application
        tells screen readers to pass arrow keys through rather than use them for reading. */}
    <div
      ref={surface}
      inert={inspector !== null}
      tabIndex={webglAvailable ? 0 : undefined}
      role={webglAvailable ? 'application' : undefined}
      aria-label={webglAvailable ? 'Interactive 3D canvas. Arrow keys pan, plus and minus zoom.' : undefined}
      aria-keyshortcuts={webglAvailable ? 'ArrowUp ArrowDown ArrowLeft ArrowRight Plus Minus' : undefined}
      data-ready={ready || !webglAvailable ? 'true' : undefined}
      className="interaction-layer relative min-h-0 flex-1 touch-none overflow-hidden overscroll-contain
        focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#416d54]
        [&_canvas]:touch-none [&_canvas]:cursor-grab
        not-data-ready:[&_canvas]:cursor-progress
        group-data-[mode=comment]:[&_canvas]:cursor-crosshair
        data-dragging:cursor-grabbing data-dragging:[&_canvas]:cursor-grabbing"
    >
      {plane && <SceneGrid plane={plane} />}
      {webglAvailable ? <Canvas shadows={{ type: PCFShadowMap }} frameloop="demand" dpr={[1, 2]} camera={{ fov: 35, position: [0, 0, 22], near: 0.1, far: 250 }}>
        <ambientLight intensity={1.5} />
        {/* Static geometry and lighting need one shadow map; camera motion only changes the view. */}
        <directionalLight shadow-autoUpdate={false} shadow-needsUpdate position={[-6, 10, 12]} intensity={3} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={7} shadow-camera-bottom={-7} shadow-normalBias={0.03} />
        <directionalLight position={[6, -3, 7]} intensity={1} color="#d4e3ed" />
        <DesignObjects objects={objects} />
        <CanvasControls objects={objects} surface={surface} mode={mode} threads={threads} draft={draft} action={action} onPlace={onPlace} onAction={onAction} onView={onView} />
      </Canvas> : <div className="mx-auto grid h-full max-w-[480px] content-center p-[30px] text-on-canvas"><h2 className="text-xl">3D rendering is unavailable</h2><p className="text-sm/relaxed text-on-canvas-muted">Enable hardware acceleration or try a WebGL-capable browser. Conversations are still available beside the canvas.</p></div>}
      <StudyBadges positions={webglAvailable ? badges : []} onInspect={setInspecting} />
      <CommentPins positions={pins} threads={threads} selectedId={selectedId} onSelect={onSelect} />
    </div>
    <div inert={inspector !== null} className="pointer-events-none absolute inset-x-gutter bottom-6 z-20 flex items-center justify-between gap-4 max-panel:justify-end max-stack:inset-x-gutter-tight max-stack:bottom-[15px]">
      <p className="canvas-hints m-0 flex items-center gap-1.5 py-2 text-2xs text-on-canvas-muted max-panel:hidden">
        <span aria-hidden="true" className="mr-1 text-base">↔</span>
        {hints.map((hint, index) => <span key={index} className="flex items-center gap-1.5">
          {index > 0 && <span className="pr-1.5">·</span>}{hint}
        </span>)}
      </p>
      <ViewControls zoom={zoom} disabled={!webglAvailable} onAction={onAction}>
        <FullscreenButton state={fullscreen} />
      </ViewControls>
    </div>
    {inspector && <StudyViewer study={inspector} fullscreen={fullscreen} threads={threads} selectedId={selectedId} draft={draft} onPlace={onPlace} onSelect={onSelect} onClose={() => setInspecting(null)} />}
  </section>;
}
