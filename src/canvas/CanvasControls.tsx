import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { useThree } from '@react-three/fiber';
import { Group, MathUtils, PerspectiveCamera, Vector2 } from 'three';
import { anchorAt, anchorWorld, dollyAt, normalizeWheel, panCamera, pointOnPlane, projectPoint, reviewPlaneView, toAnchor, zoomStepFactor } from './coordinates';
import { projectBadges, projectPins } from './projectPins';
import { CameraTween } from './cameraTween';
import { ZoomGesture } from './zoomGesture';
import { Inertia } from './inertia';
import { ZoomGlide } from './zoomGlide';
import { DRAG_SLOP_PX, RESET_DURATION_MS, WHEEL_DELTA_LIMIT } from './tuning';
import type { CameraAction, DollyLimits, Draft, Mode, PinPosition, PlaneView, Thread } from '../shared/types';

const MIN_CAMERA_DISTANCE = 6;
const MIN_FRAME_EXTENT = 10;
const FRAME_HEIGHT = 14;
const FRAME_PADDING = 3;
const MAX_CAMERA_DISTANCE = 100;
const DISTANCE_RANGE_MULTIPLIER = 3;
const FRUSTUM_PADDING = 10;
const REVEAL_DURATION_MS = 420;
const REVEAL_MARGIN_PX = 40;
const PINCH_SENSITIVITY = 0.004;
const KEYBOARD_PAN_PX = 70;
const SHIFT_KEYBOARD_PAN_PX = 220;

type Props = {
  objects: RefObject<Group | null>;
  surface: RefObject<HTMLDivElement | null>;
  mode: Mode;
  threads: Thread[];
  draft: Draft | null;
  action: CameraAction | null;
  onPlace: (draft: Draft) => void;
  onAction: (kind: CameraAction['kind']) => void;
  onView: (pins: PinPosition[], badges: PinPosition[], zoom: number, plane: PlaneView) => void;
};

// Own camera input in one place; React owns thread data, while Three.js owns the mutable camera.
export function CanvasControls({ objects, surface: surfaceRef, mode, threads, draft, action, onPlace, onAction, onView }: Props) {
  const { camera: rawCamera, gl, size, invalidate } = useThree();
  if (!(rawCamera instanceof PerspectiveCamera)) throw new Error('CanvasControls requires a perspective camera');
  const camera = rawCamera;
  const gesture = useRef(new ZoomGesture());
  const tween = useRef(new CameraTween());
  const glide = useRef(new Inertia());
  const zoomGlide = useRef(new ZoomGlide());
  const zoomReference = useRef<number | null>(null);
  const handledAction = useRef<number | null>(null);
  const frameDistance = Math.max(MIN_FRAME_EXTENT, FRAME_HEIGHT / (size.width / size.height))
    / (2 * Math.tan(MathUtils.degToRad(camera.fov / 2))) + FRAME_PADDING;
  const limits: DollyLimits = {
    min: MIN_CAMERA_DISTANCE,
    max: Math.max(MAX_CAMERA_DISTANCE, frameDistance * DISTANCE_RANGE_MULTIPLIER,
      (zoomReference.current ?? frameDistance) * DISTANCE_RANGE_MULTIPLIER),
  };

  // Projection and occlusion update together, only when their inputs change.
  const publish = useCallback(() => {
    objects.current?.updateWorldMatrix(true, true);
    const meshes = objects.current?.children ?? [];
    const pins = projectPins(threads, draft, camera, objects.current, meshes, size);
    onView(pins, projectBadges(camera, meshes, size),
      Math.round((zoomReference.current ?? frameDistance) / camera.position.z * 100),
      reviewPlaneView(camera, size));
    invalidate();
  }, [camera, draft, frameDistance, invalidate, objects, onView, size.height, size.width, threads]);

  // The camera starts framed once; resize changes projection without destroying the user's location.
  useEffect(() => {
    if (zoomReference.current === null) {
      camera.position.set(0, 0, frameDistance);
      zoomReference.current = frameDistance;
    }
    // Keep the entire allowed dolly range inside the frustum, including tall viewports.
    camera.far = Math.max(limits.max, camera.position.z) + FRUSTUM_PADDING;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    publish();
  }, [camera, frameDistance, limits.max, publish]);

  // Gesture handlers and the navigation tween read volatile values here, so neither goes stale.
  const live = useRef({ size, mode, onPlace, onAction, publish, limits, frameDistance });
  useLayoutEffect(() => { live.current = { size, mode, onPlace, onAction, publish, limits, frameDistance }; });

  // Button and keyboard zoom act on the viewport centre, since neither has a pointer to anchor to.
  // The anchor is locked once and reused every frame of the glide, so the centre truly holds still.
  const dollyFromCentre = useCallback((factor: number) => {
    const { size } = live.current;
    const centre = new Vector2(size.width / 2, size.height / 2);
    const anchor = pointOnPlane(centre, 0, camera, size);
    if (!anchor) return;
    zoomGlide.current.to(factor, (step) => {
      const view = live.current;
      dollyAt(camera, centre, anchor, step, view.size, view.limits);
      view.publish();
    });
  }, [camera]);

  // Reading the frame distance from the ref keeps this callback stable, so the key listeners
  // never re-register on a resize.
  const dollyStep = useCallback((direction: 1 | -1) => {
    const reference = zoomReference.current ?? live.current.frameDistance;
    dollyFromCentre(zoomStepFactor(reference, camera.position.z * zoomGlide.current.pending, direction));
  }, [camera, dollyFromCentre]);

  // Toolbar and list navigation terminate any in-flight wheel lock before moving the view.
  useEffect(() => {
    if (!action || handledAction.current === action.id) return;
    handledAction.current = action.id;
    gesture.current.clear();
    tween.current.cancel();
    glide.current.cancel();
    zoomGlide.current.cancel();
    if (action.kind === 'reset') {
      // Glide home rather than teleport. Reset is a navigation like any other, and arriving
      // instantly loses the sense of where the view came from.
      const from = camera.position.clone();
      zoomReference.current = frameDistance;
      tween.current.run(RESET_DURATION_MS, (progress) => {
        camera.position.set(from.x * (1 - progress), from.y * (1 - progress), from.z + (frameDistance - from.z) * progress);
        camera.updateMatrixWorld();
        live.current.publish();
      });
    }
    if (action.kind === 'in' || action.kind === 'out') dollyStep(action.kind === 'in' ? 1 : -1);
    if (action.kind === 'reveal' && action.anchor) {
      const point = anchorWorld(action.anchor, objects.current);
      const projected = projectPoint(point, camera, size);
      if (!projected.visible || projected.x < REVEAL_MARGIN_PX || projected.x > size.width - REVEAL_MARGIN_PX
        || projected.y < REVEAL_MARGIN_PX || projected.y > size.height - REVEAL_MARGIN_PX) {
        // Glide rather than teleport, so the reader keeps their bearings on where the anchor came from.
        const from = new Vector2(camera.position.x, camera.position.y);
        tween.current.run(REVEAL_DURATION_MS, (progress) => {
          camera.position.x = from.x + (point.x - from.x) * progress;
          camera.position.y = from.y + (point.y - from.y) * progress;
          camera.updateMatrixWorld();
          live.current.publish();
        });
      }
    }
    publish();
  }, [action, camera, dollyStep, frameDistance, publish, size.height, size.width]);

  // Native non-passive input allows this surface to consume gestures without zooming the whole page.
  useEffect(() => {
    const mountedSurface = surfaceRef.current;
    if (!mountedSurface) return;
    const surface: HTMLDivElement = mountedSurface;
    const burst = gesture.current;
    let drag: { id: number; start: Vector2; previous: Vector2; depth: number; moved: boolean; pan: boolean } | null = null;

    // Bounding-client coordinates stay correct after scrolling, resizing, and panel changes.
    function local(event: MouseEvent | WheelEvent | PointerEvent) {
      const rect = gl.domElement.getBoundingClientRect();
      return new Vector2(event.clientX - rect.left, event.clientY - rect.top);
    }

    // A fixed world target prevents depth switching between adjacent objects during pinch momentum.
    function wheel(event: WheelEvent) {
      // Continuation events may be non-cancelable but still carry gesture movement.
      if (event.cancelable) event.preventDefault();
      tween.current.cancel();
      glide.current.cancel();
      const { size, publish } = live.current;
      const [x, y] = normalizeWheel(event.deltaX, event.deltaY, event.deltaMode, size);
      if (event.ctrlKey) {
        const target = burst.capture(() => {
          const pointer = local(event);
          return { pointer, anchor: anchorAt(pointer, camera, size, objects.current?.children ?? []).point };
        });
        zoomGlide.current.to(Math.exp(MathUtils.clamp(y, -WHEEL_DELTA_LIMIT, WHEEL_DELTA_LIMIT) * PINCH_SENSITIVITY), (step) => {
          const view = live.current;
          dollyAt(camera, target.pointer, target.anchor, step, view.size, view.limits);
          view.publish();
        });
      } else {
        burst.clear();
        zoomGlide.current.cancel();
        panCamera(camera, x, y, size.height);
      }
      publish();
    }

    // Capture keeps a drag coherent even when the pointer leaves the canvas bounds.
    function pointerDown(event: PointerEvent) {
      if (!event.isPrimary || (event.button !== 0 && event.button !== 1) || (event.target instanceof Element && event.target.closest('button'))) return;
      burst.clear();
      tween.current.cancel();
      glide.current.cancel();
      glide.current.reset();
      zoomGlide.current.cancel();
      const { size, mode } = live.current;
      const point = local(event);
      drag = { id: event.pointerId, start: point, previous: point, depth: anchorAt(point, camera, size, objects.current?.children ?? []).point.z, moved: false, pan: mode === 'pan' || event.button === 1 };
      surface.setPointerCapture(event.pointerId);
      if (drag.pan) surface.dataset.dragging = 'true';
    }

    // Movement beyond a small slop radius can never become a comment on pointer-up.
    function pointerMove(event: PointerEvent) {
      if (!drag || drag.id !== event.pointerId) return;
      const point = local(event);
      // Outgrowing the slop radius turns any drag into a pan, so Comment mode is never inert.
      if (!drag.moved && point.distanceTo(drag.start) > DRAG_SLOP_PX) {
        drag.moved = true;
        drag.pan = true;
        surface.dataset.dragging = 'true';
      }
      if (drag.pan) {
        const [x, y] = [drag.previous.x - point.x, drag.previous.y - point.y];
        glide.current.track(x, y);
        panCamera(camera, x, y, live.current.size.height, drag.depth);
        live.current.publish();
      }
      drag.previous = point;
    }

    // Only a deliberate stationary click creates a draft, including on empty space.
    function pointerUp(event: PointerEvent) {
      if (!drag || drag.id !== event.pointerId) return;
      const { size, onPlace } = live.current;
      const create = !drag.pan && !drag.moved;
      const point = local(event);
      const throwing = drag.pan && drag.moved ? drag.depth : null;
      endDrag();
      // Let the pan settle instead of stopping dead the instant the button comes up.
      if (throwing !== null) {
        glide.current.release((x, y) => {
          panCamera(camera, x, y, live.current.size.height, throwing);
          live.current.publish();
        });
      }
      if (create) onPlace(toAnchor(anchorAt(point, camera, size, objects.current?.children ?? [])));
    }

    // Arrow keys pan, +/- zoom and R resets, so the canvas is reachable without a pointer at all.
    // Scoped to this surface rather than the document: typing an R in the panel is not a navigation.
    function keydown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const { publish, size } = live.current;
      if (/^[rR]$/.test(event.key)) {
        event.preventDefault();
        // Routed through the same action the button raises, so reset has one implementation.
        live.current.onAction('reset');
        return;
      }
      const step = event.shiftKey ? SHIFT_KEYBOARD_PAN_PX : KEYBOARD_PAN_PX;
      const pan: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
      };
      const zoomKey = event.key === '+' || event.key === '=' || event.key === '-';
      if (!pan[event.key] && !zoomKey) return;
      event.preventDefault();
      burst.clear();
      tween.current.cancel();
      // A zoom still gliding keeps correcting laterally toward its locked anchor, which would
      // drag the camera back against whatever this key just did.
      zoomGlide.current.cancel();
      if (pan[event.key]) {
        panCamera(camera, pan[event.key][0], pan[event.key][1], size.height);
      } else {
        dollyStep(event.key === '-' ? -1 : 1);
      }
      publish();
    }

    // End the drag without touching momentum. Releasing capture fires lostpointercapture a beat
    // later, and a full cancel there would kill the glide the release had just started.
    function endDrag() {
      burst.clear();
      tween.current.cancel();
      const pointerId = drag?.id;
      drag = null;
      delete surface.dataset.dragging;
      if (pointerId !== undefined && surface.hasPointerCapture(pointerId)) surface.releasePointerCapture(pointerId);
    }

    // Blur and pointer cancellation abandon the gesture outright, momentum included.
    function cancel() {
      endDrag();
      glide.current.cancel();
      zoomGlide.current.cancel();
    }

    surface.addEventListener('keydown', keydown);
    surface.addEventListener('wheel', wheel, { passive: false });
    surface.addEventListener('pointerdown', pointerDown);
    surface.addEventListener('pointermove', pointerMove);
    surface.addEventListener('pointerup', pointerUp);
    surface.addEventListener('pointercancel', cancel);
    surface.addEventListener('lostpointercapture', endDrag);
    window.addEventListener('blur', cancel);
    return () => {
      cancel();
      surface.removeEventListener('keydown', keydown);
      surface.removeEventListener('wheel', wheel);
      surface.removeEventListener('pointerdown', pointerDown);
      surface.removeEventListener('pointermove', pointerMove);
      surface.removeEventListener('pointerup', pointerUp);
      surface.removeEventListener('pointercancel', cancel);
      surface.removeEventListener('lostpointercapture', endDrag);
      window.removeEventListener('blur', cancel);
    };
  }, [camera, dollyStep, gl, objects, surfaceRef]);

  return null;
}
