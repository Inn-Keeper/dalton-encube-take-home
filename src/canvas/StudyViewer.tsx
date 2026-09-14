import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { MathUtils, PerspectiveCamera, Vector2, type Scene } from 'three';
import { CommentPins } from './CommentPins';
import { Form, type Study } from './studies';
import { anchorAt, reviewPlaneView, toAnchor, zoomStepFactor } from './coordinates';
import { projectPins } from './projectPins';
import { Inertia } from './inertia';
import { ZoomGlide } from './zoomGlide';
import { TouchPinch } from './touchPinch';
import { CameraTween } from './cameraTween';
import { SceneGrid } from './SceneGrid';
import { StudyInfo } from './StudyInfo';
import { FullscreenButton, ViewControls } from './ViewControls';
import { DRAG_SLOP_PX, RESET_DURATION_MS, WHEEL_DELTA_LIMIT } from './tuning';
import { chipButton } from '../shared/ui';
import { Kbd } from '../shared/Kbd';
import type { CameraAction, Draft, PinPosition, PlaneView, Thread } from '../shared/types';
import type { FullscreenState } from '../shared/useFullscreen';

// Straight up and straight down read as gimbal noise rather than inspection, so the tilt stops short.
const MAX_TILT = MathUtils.degToRad(85);
const RADIANS_PER_PIXEL = 0.008;
const KEY_STEP = MathUtils.degToRad(12);
// Matches the zoom ease, so a key and a drag settle at the same rate rather than one snapping.
const KEY_TURN_MS = 220;
// The form should fill the stage without leaving it, and stay recognisable when pushed away.
const NEAR = 0.35;
const FAR = 2.5;
const WHEEL_ZOOM_SENSITIVITY = 0.002;

type ViewerProps = {
  study: Study;
  fullscreen: FullscreenState;
  threads: Thread[];
  selectedId: string | null;
  draft: Draft | null;
  onPlace: (draft: Draft) => void;
  onSelect: (id: string) => void;
  onClose: () => void;
};

/** Everything the outer pointer handlers need from inside the canvas. Published from a child rather
 *  than threaded through props, because only React Three Fiber can hand out the live camera. */
type Stage = { camera: PerspectiveCamera; scene: Scene; width: number; height: number };

// Owns the camera distance and everything projected from it: this form's pins, the grid's tie to the
// review plane, and the raycasting handle the outer pointer handlers need. One effect, because all
// of it changes together whenever the form turns, the stage resizes, or the view zooms.
function Rig({ turn, distance, threads, draft, onPins, onStage, onPlane }: {
  turn: number; distance: number; threads: Thread[]; draft: Draft | null;
  onPins: (pins: PinPosition[]) => void; onStage: (stage: Stage) => void; onPlane: (plane: PlaneView) => void;
}) {
  const { camera: rawCamera, scene, size, invalidate } = useThree();
  if (!(rawCamera instanceof PerspectiveCamera)) throw new Error('StudyViewer requires a perspective camera');
  const camera = rawCamera;
  useLayoutEffect(() => {
    camera.position.z = distance;
    camera.updateMatrixWorld();
    scene.updateMatrixWorld(true);
    onStage({ camera, scene, width: size.width, height: size.height });
    onPins(projectPins(threads, draft, camera, scene, scene.children, size));
    onPlane(reviewPlaneView(camera, size));
    invalidate();
  }, [camera, distance, draft, invalidate, onPins, onPlane, onStage, scene, size.height, size.width, threads, turn]);
  return null;
}

/** A form on its own, free to turn a full circle, layered over the canvas rather than over the page.
 *  The conversation panel stays readable and live beside it, and comments can be placed here too.
 *
 *  Fully opaque: this replaces the canvas view rather than dimming it. A translucent scrim let the
 *  forms behind show through as silhouettes under the one being inspected. */
export function StudyViewer({ study, fullscreen, threads, selectedId, draft, onPlace, onSelect, onClose }: ViewerProps) {
  const stageElement = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const glide = useRef(new Inertia());
  const zoomGlide = useRef(new ZoomGlide());
  const touchPinch = useRef(new TouchPinch());
  const homing = useRef(new CameraTween());
  const turning = useRef(new CameraTween());
  const [pins, setPins] = useState<PinPosition[]>([]);
  const [plane, setPlane] = useState<PlaneView | null>(null);
  // Distance rather than a zoom factor: it is what the camera actually uses. The state is where the
  // camera is now; the ref is where it is heading. Stepping from the state would measure a view a
  // frame or more behind the glide, and two quick presses would not add up to two stops.
  const [distance, setDistance] = useState(study.frame);
  const target = useRef(study.frame);
  // Rotation resets with the component, so every inspection starts from the canvas orientation.
  const [turn, setTurn] = useState({ yaw: 0, tilt: 0 });
  // Only this form's conversations belong here; board and empty-space comments have no surface to
  // sit on. Memoised because the projection effect keys off these: a fresh array every render would
  // re-project, re-render, and re-project again without end.
  const name = `form-${study.id}`;
  const mine = useMemo(() => threads.filter((thread) => thread.on === name), [threads, name]);
  const myDraft = draft?.on === name ? draft : null;

  const publishStage = useCallback((next: Stage) => { stage.current = next; }, []);
  const zoom = Math.round(study.frame / distance * 100);

  // One follower for every zoom input here, so a click, a key and a wheel all arrive the same way.
  // Clamped once on the target: clamping each frame instead would make the steps stop adding up.
  const zoomBy = useCallback((factor: number) => {
    const next = MathUtils.clamp(target.current * factor, study.frame * NEAR, study.frame * FAR);
    const applied = next / target.current;
    target.current = next;
    zoomGlide.current.to(applied, (step) => setDistance((current) => current * step));
  }, [study.frame]);

  // The same ten-percent stops the canvas uses, so zooming reads identically in both views. Stepping
  // measures from the target rather than the camera, or presses during a glide would undershoot.
  const navigate = useCallback((kind: CameraAction['kind']) => {
    // Reset restores the whole view, orientation included: the form goes back to how the canvas
    // shows it. Resetting only the distance would leave it facing somewhere you did not choose.
    if (kind === 'reset') {
      zoomGlide.current.cancel();
      glide.current.cancel();
      turning.current.cancel();
      // Eased home, like the canvas: orientation and distance travel back together.
      const from = { ...turn, distance };
      target.current = study.frame;
      homing.current.run(RESET_DURATION_MS, (progress) => {
        setTurn({ yaw: from.yaw * (1 - progress), tilt: from.tilt * (1 - progress) });
        setDistance(from.distance + (study.frame - from.distance) * progress);
      });
      return;
    }
    if (kind !== 'in' && kind !== 'out') return;
    zoomBy(zoomStepFactor(study.frame, target.current, kind === 'in' ? 1 : -1));
  }, [distance, study.frame, turn, zoomBy]);

  // Nothing here to pan, so any wheel zooms, pinch included. Non-passive, or the page would scroll.
  useEffect(() => {
    const element = stageElement.current;
    if (!element) return;
    function wheel(event: WheelEvent) {
      event.preventDefault();
      zoomBy(Math.exp(MathUtils.clamp(event.deltaY, -WHEEL_DELTA_LIMIT, WHEEL_DELTA_LIMIT) * WHEEL_ZOOM_SENSITIVITY));
    }
    element.addEventListener('wheel', wheel, { passive: false });
    return () => { element.removeEventListener('wheel', wheel); };
  }, [zoomBy]);

  // Take the keyboard on open. Handing it back belongs to the scene: the badge is inside a subtree
  // this overlay marks inert, and focusing it from here races the commit that lifts that.
  useLayoutEffect(() => { stageElement.current?.focus(); }, []);

  // A glide outliving its component would call setState on nothing.
  useEffect(() => {
    const running = [glide.current, zoomGlide.current, homing.current, turning.current];
    return () => { running.forEach((animation) => animation.cancel()); };
  }, []);

  // Escape closes from anywhere, including while the reply box in the panel has focus.
  useEffect(() => {
    function escape(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
      event.preventDefault();
      onClose();
    }
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('keydown', escape); };
  }, [onClose]);

  // Yaw wraps freely for a full circle; only the tilt is bounded.
  function rotate(x: number, y: number) {
    setTurn((current) => ({ yaw: current.yaw + x, tilt: MathUtils.clamp(current.tilt + y, -MAX_TILT, MAX_TILT) }));
  }

  function down(event: PointerEvent<HTMLDivElement>) {
    if (event.target instanceof Element && event.target.closest('button')) return;
    if (event.pointerType === 'touch') {
      const midpoint = touchPinch.current.down(event.pointerId, new Vector2(event.clientX, event.clientY));
      event.currentTarget.setPointerCapture(event.pointerId);
      if (midpoint) {
        drag.current = null;
        glide.current.cancel();
        zoomGlide.current.cancel();
        return;
      }
      if (touchPinch.current.active) return;
    }
    glide.current.cancel();
    glide.current.reset();
    homing.current.cancel();
    turning.current.cancel();
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'touch') {
      const pinch = touchPinch.current.move(event.pointerId, new Vector2(event.clientX, event.clientY));
      if (pinch) {
        zoomBy(pinch.factor);
        return;
      }
      if (touchPinch.current.active) return;
    }
    const active = drag.current;
    if (!active || active.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - active.x, event.clientY - active.y) > DRAG_SLOP_PX) active.moved = true;
    if (active.moved) {
      glide.current.track(event.clientX - active.x, event.clientY - active.y);
      rotate((event.clientX - active.x) * RADIANS_PER_PIXEL, (event.clientY - active.y) * RADIANS_PER_PIXEL);
    }
    drag.current = { ...active, x: event.clientX, y: event.clientY };
  }

  // A stationary click comments, exactly as on the canvas; a turn never leaves one behind.
  function up(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'touch' && touchPinch.current.up(event.pointerId)) {
      drag.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }
    const active = drag.current;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    // A released turn keeps spinning briefly, so the form settles rather than freezing mid-gesture.
    if (active?.moved) return glide.current.release((x, y) => rotate(x * RADIANS_PER_PIXEL, y * RADIANS_PER_PIXEL));
    if (!active || !stage.current) return;
    const box = event.currentTarget.getBoundingClientRect();
    const { camera, scene, width, height } = stage.current;
    const hit = anchorAt(new Vector2(event.clientX - box.left, event.clientY - box.top), camera, { width, height }, scene.children);
    // Empty space here still belongs to this form. A world point would be meaningless on the canvas,
    // where this scene's origin sits nowhere in particular; anchored to the form, a note left beside
    // it stays beside it in both views and turns with it.
    onPlace(toAnchor({ point: hit.point, form: hit.form ?? scene.getObjectByName(name) ?? null }));
  }

  function cancelPointer(event: PointerEvent<HTMLDivElement>) {
    touchPinch.current.clear();
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    glide.current.cancel();
    zoomGlide.current.cancel();
  }

  // A key turns by easing into its step rather than jumping there, so the keyboard feels like the
  // drag. Held keys repeat: each press re-aims from wherever the last ease had reached, which adds
  // up to one continuous turn instead of a stack of competing animations.
  function stepTurn(x: number, y: number) {
    glide.current.cancel();
    homing.current.cancel();
    const from = turn;
    const to = { yaw: from.yaw + x, tilt: MathUtils.clamp(from.tilt + y, -MAX_TILT, MAX_TILT) };
    turning.current.run(KEY_TURN_MS, (progress) => {
      setTurn({ yaw: from.yaw + (to.yaw - from.yaw) * progress, tilt: from.tilt + (to.tilt - from.tilt) * progress });
    });
  }

  // Arrows turn; shift with the vertical arrows zooms, matching the canvas's plus and minus. Shift
  // rather than a second pair of keys: the arrows are already under the hand that is turning.
  function keydown(event: KeyboardEvent<HTMLDivElement>) {
    if (/^[rR]$/.test(event.key)) {
      event.preventDefault();
      return navigate('reset');
    }
    const zoom: Record<string, 1 | -1> = { ArrowUp: 1, ArrowDown: -1 };
    if (event.shiftKey && zoom[event.key]) {
      event.preventDefault();
      return navigate(zoom[event.key] === 1 ? 'in' : 'out');
    }
    const step: Record<string, [number, number]> = {
      ArrowLeft: [-KEY_STEP, 0], ArrowRight: [KEY_STEP, 0], ArrowUp: [0, -KEY_STEP], ArrowDown: [0, KEY_STEP],
    };
    if (event.shiftKey || !step[event.key]) return;
    event.preventDefault();
    stepTurn(step[event.key][0], step[event.key][1]);
  }

  return (
    <div className="study-viewer absolute inset-0 z-30 flex animate-conversation-enter flex-col bg-canvas-deep" role="group" aria-label={`${study.label} inspector`}>
      {/* The name lives on the part sheet, which stays readable even collapsed, so repeating it in
          a header directly above it would say the same thing twice in two stacked places. */}
      <div className="flex shrink-0 items-center justify-between gap-4 px-gutter pt-4 pb-3 max-stack:px-gutter-tight">
        <span className="text-2xs font-bold tracking-[1.5px] text-on-canvas-muted">INSPECT</span>
        {/* The shared quiet button is dark text on a pale chip, which disappears on this ground. */}
        <button type="button" className={`${chipButton} border-[#46525b] bg-[#2a343d] text-on-canvas hover:bg-[#354049]`} title="Return to the canvas (Esc)" onClick={onClose}>Close <Kbd>Esc</Kbd></button>
      </div>
      <div
        ref={stageElement}
        tabIndex={0}
        role="application"
        aria-label={`${study.label}, free to turn. Arrow keys turn, shift with up or down zooms, R resets. Click to comment.`}
        aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Shift+ArrowUp Shift+ArrowDown R"
        className="study-stage relative min-h-0 flex-1 cursor-grab touch-none overflow-hidden focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#416d54] [&:active]:cursor-grabbing"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={cancelPointer}
        onKeyDown={keydown}
      >
        {plane && <SceneGrid plane={plane} />}
        <Canvas frameloop="demand" dpr={[1, 2]} camera={{ fov: 35, position: [0, 0, study.frame], near: 0.1, far: 100 }}>
          <ambientLight intensity={1.6} />
          <directionalLight position={[-4, 6, 8]} intensity={2.6} />
          <directionalLight position={[5, -3, 6]} intensity={0.9} color="#d4e3ed" />
          {/* Two nested groups rather than one Euler: yaw around world up, then tilt, in that order. */}
          <group rotation={[0, turn.yaw, 0]}>
            <group rotation={[turn.tilt, 0, 0]}><Form study={study} /></group>
          </group>
          <Rig turn={turn.yaw + turn.tilt} distance={distance} threads={mine} draft={myDraft} onPins={setPins} onStage={publishStage} onPlane={setPlane} />
        </Canvas>
        {/* The same pin overlay the canvas uses, so a comment looks and behaves identically here.
            Given every thread, not just this form's: the pin's number comes from that list, and a
            filtered one would name the same conversation differently in each view. */}
        <CommentPins positions={pins} threads={threads} selectedId={selectedId} onSelect={onSelect} />
        <StudyInfo study={study} />
        <div className="pointer-events-none absolute inset-x-gutter bottom-6 z-20 flex justify-end max-stack:inset-x-gutter-tight max-stack:bottom-[15px]">
          <ViewControls zoom={zoom} onAction={navigate}>
            <FullscreenButton state={fullscreen} />
          </ViewControls>
        </div>
      </div>
      <p className="shrink-0 px-gutter py-3 text-2xs text-on-canvas-muted max-stack:px-gutter-tight">
        Drag to turn · Arrow keys turn · Shift with up or down zooms · R resets · Click to comment
      </p>
    </div>
  );
}
