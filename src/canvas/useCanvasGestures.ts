import { useEffect } from 'react';
import type { RefObject } from 'react';
import { Group, MathUtils, PerspectiveCamera, Vector2, WebGLRenderer } from 'three';
import { anchorAt, dollyAt, normalizeWheel, panCamera, toAnchor } from './coordinates';
import { CameraTween } from './cameraTween';
import { ZoomGesture } from './zoomGesture';
import { Inertia } from './inertia';
import { ZoomGlide } from './zoomGlide';
import { TouchPinch } from './touchPinch';
import { DRAG_SLOP_PX, WHEEL_DELTA_LIMIT } from './tuning';
import type { CameraAction, DollyLimits, Draft, Mode, Viewport } from '../shared/types';

const PINCH_SENSITIVITY = 0.004;
const KEYBOARD_PAN_PX = 70;
const SHIFT_KEYBOARD_PAN_PX = 220;

/** What the handlers read fresh on each event. Held in a ref by the caller so these listeners can
 *  register once and still see the current viewport, mode and callbacks. */
export type LiveView = {
  size: Viewport;
  mode: Mode;
  onPlace: (draft: Draft) => void;
  onAction: (kind: CameraAction['kind']) => void;
  publish: () => void;
  limits: DollyLimits;
  frameDistance: number;
};

/** The animations a gesture has to interrupt. Owned by the caller, which runs its own navigation
 *  tweens through the same instances, so a button press and a wheel burst cannot fight each other. */
export type Motion = {
  gesture: ZoomGesture;
  tween: CameraTween;
  glide: Inertia;
  zoomGlide: ZoomGlide;
  touchPinch: TouchPinch;
};

type Params = {
  camera: PerspectiveCamera;
  gl: WebGLRenderer;
  surfaceRef: RefObject<HTMLDivElement | null>;
  objects: RefObject<Group | null>;
  live: RefObject<LiveView>;
  motion: Motion;
  dollyStep: (direction: 1 | -1) => void;
};

/**
 * Every raw input the canvas accepts: wheel, pointer and keyboard. Separated from the camera state
 * it drives because these are one concern — turning device events into camera intent — while framing,
 * projection and navigation actions are another. Wheel and pointer stay together here rather than
 * splitting further: they share the drag and pinch bookkeeping below and must preempt each other.
 */
export function useCanvasGestures({ camera, gl, surfaceRef, objects, live, motion, dollyStep }: Params) {
  // Native non-passive input allows this surface to consume gestures without zooming the whole page.
  useEffect(() => {
    const mountedSurface = surfaceRef.current;
    if (!mountedSurface) return;
    const surface: HTMLDivElement = mountedSurface;
    const burst = motion.gesture;
    let drag: { id: number; start: Vector2; previous: Vector2; depth: number; moved: boolean; pan: boolean } | null = null;
    let pinchTarget: { pointer: Vector2; anchor: ReturnType<typeof anchorAt>['point'] } | null = null;

    // Bounding-client coordinates stay correct after scrolling, resizing, and panel changes.
    function local(event: MouseEvent | WheelEvent | PointerEvent) {
      const rect = gl.domElement.getBoundingClientRect();
      return new Vector2(event.clientX - rect.left, event.clientY - rect.top);
    }

    // A fixed world target prevents depth switching between adjacent objects during pinch momentum.
    function wheel(event: WheelEvent) {
      // Continuation events may be non-cancelable but still carry gesture movement.
      if (event.cancelable) event.preventDefault();
      motion.tween.cancel();
      motion.glide.cancel();
      const { size, publish } = live.current;
      const [x, y] = normalizeWheel(event.deltaX, event.deltaY, event.deltaMode, size);
      if (event.ctrlKey) {
        const target = burst.capture(() => {
          const pointer = local(event);
          return { pointer, anchor: anchorAt(pointer, camera, size, objects.current?.children ?? []).point };
        });
        motion.zoomGlide.to(Math.exp(MathUtils.clamp(y, -WHEEL_DELTA_LIMIT, WHEEL_DELTA_LIMIT) * PINCH_SENSITIVITY), (step) => {
          const view = live.current;
          dollyAt(camera, target.pointer, target.anchor, step, view.size, view.limits);
          view.publish();
        });
      } else {
        burst.clear();
        motion.zoomGlide.cancel();
        panCamera(camera, x, y, size.height);
      }
      publish();
    }

    // Capture keeps a drag coherent even when the pointer leaves the canvas bounds.
    function pointerDown(event: PointerEvent) {
      if ((event.pointerType !== 'touch' && !event.isPrimary) || (event.button !== 0 && event.button !== 1)
        || (event.target instanceof Element && event.target.closest('button'))) return;
      const point = local(event);
      if (event.pointerType === 'touch') {
        const midpoint = motion.touchPinch.down(event.pointerId, point);
        surface.setPointerCapture(event.pointerId);
        if (midpoint) {
          burst.clear();
          motion.tween.cancel();
          motion.glide.cancel();
          motion.zoomGlide.cancel();
          drag = null;
          delete surface.dataset.dragging;
          pinchTarget = { pointer: midpoint, anchor: anchorAt(midpoint, camera, live.current.size, objects.current?.children ?? []).point };
          return;
        }
        if (motion.touchPinch.active) return;
      }
      burst.clear();
      motion.tween.cancel();
      motion.glide.cancel();
      motion.glide.reset();
      motion.zoomGlide.cancel();
      const { size, mode } = live.current;
      drag = { id: event.pointerId, start: point, previous: point, depth: anchorAt(point, camera, size, objects.current?.children ?? []).point.z, moved: false, pan: mode === 'pan' || event.button === 1 };
      if (!surface.hasPointerCapture(event.pointerId)) surface.setPointerCapture(event.pointerId);
      if (drag.pan) surface.dataset.dragging = 'true';
    }

    // Movement beyond a small slop radius can never become a comment on pointer-up.
    function pointerMove(event: PointerEvent) {
      const point = local(event);
      if (event.pointerType === 'touch') {
        const pinch = motion.touchPinch.move(event.pointerId, point);
        if (pinch && pinchTarget) {
          pinchTarget.pointer.copy(pinch.midpoint);
          dollyAt(camera, pinchTarget.pointer, pinchTarget.anchor, pinch.factor, live.current.size, live.current.limits);
          live.current.publish();
          return;
        }
        if (motion.touchPinch.active) return;
      }
      if (!drag || drag.id !== event.pointerId) return;
      // Outgrowing the slop radius turns any drag into a pan, so Comment mode is never inert.
      if (!drag.moved && point.distanceTo(drag.start) > DRAG_SLOP_PX) {
        drag.moved = true;
        drag.pan = true;
        surface.dataset.dragging = 'true';
      }
      if (drag.pan) {
        const [x, y] = [drag.previous.x - point.x, drag.previous.y - point.y];
        motion.glide.track(x, y);
        panCamera(camera, x, y, live.current.size.height, drag.depth);
        live.current.publish();
      }
      drag.previous = point;
    }

    // Only a deliberate stationary click creates a draft, including on empty space.
    function pointerUp(event: PointerEvent) {
      if (event.pointerType === 'touch') {
        const wasPinching = motion.touchPinch.up(event.pointerId);
        if (wasPinching) {
          drag = null;
          pinchTarget = null;
          if (surface.hasPointerCapture(event.pointerId)) surface.releasePointerCapture(event.pointerId);
          return;
        }
      }
      if (!drag || drag.id !== event.pointerId) return;
      const { size, onPlace } = live.current;
      const create = !drag.pan && !drag.moved;
      const point = local(event);
      const throwing = drag.pan && drag.moved ? drag.depth : null;
      endDrag();
      // Let the pan settle instead of stopping dead the instant the button comes up.
      if (throwing !== null) {
        motion.glide.release((x, y) => {
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
      motion.tween.cancel();
      // A zoom still gliding keeps correcting laterally toward its locked anchor, which would
      // drag the camera back against whatever this key just did.
      motion.zoomGlide.cancel();
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
      motion.tween.cancel();
      const pointerId = drag?.id;
      drag = null;
      delete surface.dataset.dragging;
      if (pointerId !== undefined && surface.hasPointerCapture(pointerId)) surface.releasePointerCapture(pointerId);
    }

    // Blur and pointer cancellation abandon the gesture outright, momentum included.
    function cancel() {
      motion.touchPinch.clear();
      pinchTarget = null;
      endDrag();
      motion.glide.cancel();
      motion.zoomGlide.cancel();
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
  }, [camera, dollyStep, gl, live, motion, objects, surfaceRef]);
}
