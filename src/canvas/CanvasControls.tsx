import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { useThree } from '@react-three/fiber';
import { Group, MathUtils, PerspectiveCamera, Vector2 } from 'three';
import { anchorWorld, dollyAt, pointOnPlane, projectPoint, reviewPlaneView, zoomStepFactor } from './coordinates';
import { projectBadges, projectPins } from './projectPins';
import { CameraTween } from './cameraTween';
import { ZoomGesture } from './zoomGesture';
import { Inertia } from './inertia';
import { ZoomGlide } from './zoomGlide';
import { TouchPinch } from './touchPinch';
import { useCanvasGestures, type LiveView, type Motion } from './useCanvasGestures';
import { RESET_DURATION_MS } from './tuning';
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

// Own the camera in one place; React owns thread data, while Three.js owns the mutable camera.
// Raw device input lives in useCanvasGestures; what remains here is framing, projection, and the
// navigation actions the toolbar and comment list raise.
export function CanvasControls({ objects, surface: surfaceRef, mode, threads, draft, action, onPlace, onAction, onView }: Props) {
  const { camera: rawCamera, gl, size, invalidate } = useThree();
  if (!(rawCamera instanceof PerspectiveCamera)) throw new Error('CanvasControls requires a perspective camera');
  const camera = rawCamera;
  // One set of animations for both gestures and navigation, so a button press and a wheel burst
  // interrupt each other instead of running at once.
  const motion = useRef<Motion>({
    gesture: new ZoomGesture(), tween: new CameraTween(), glide: new Inertia(),
    zoomGlide: new ZoomGlide(), touchPinch: new TouchPinch(),
  }).current;
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
  const live = useRef<LiveView>({ size, mode, onPlace, onAction, publish, limits, frameDistance });
  useLayoutEffect(() => { live.current = { size, mode, onPlace, onAction, publish, limits, frameDistance }; });

  // Button and keyboard zoom act on the viewport centre, since neither has a pointer to anchor to.
  // The anchor is locked once and reused every frame of the glide, so the centre truly holds still.
  const dollyFromCentre = useCallback((factor: number) => {
    const { size } = live.current;
    const centre = new Vector2(size.width / 2, size.height / 2);
    const anchor = pointOnPlane(centre, 0, camera, size);
    if (!anchor) return;
    motion.zoomGlide.to(factor, (step) => {
      const view = live.current;
      dollyAt(camera, centre, anchor, step, view.size, view.limits);
      view.publish();
    });
  }, [camera, motion]);

  // Reading the frame distance from the ref keeps this callback stable, so the key listeners
  // never re-register on a resize.
  const dollyStep = useCallback((direction: 1 | -1) => {
    const reference = zoomReference.current ?? live.current.frameDistance;
    dollyFromCentre(zoomStepFactor(reference, camera.position.z * motion.zoomGlide.pending, direction));
  }, [camera, dollyFromCentre, motion]);

  // Toolbar and list navigation terminate any in-flight wheel lock before moving the view.
  useEffect(() => {
    if (!action || handledAction.current === action.id) return;
    handledAction.current = action.id;
    motion.gesture.clear();
    motion.tween.cancel();
    motion.glide.cancel();
    motion.zoomGlide.cancel();
    if (action.kind === 'reset') {
      // Glide home rather than teleport. Reset is a navigation like any other, and arriving
      // instantly loses the sense of where the view came from.
      const from = camera.position.clone();
      zoomReference.current = frameDistance;
      motion.tween.run(RESET_DURATION_MS, (progress) => {
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
        motion.tween.run(REVEAL_DURATION_MS, (progress) => {
          camera.position.x = from.x + (point.x - from.x) * progress;
          camera.position.y = from.y + (point.y - from.y) * progress;
          camera.updateMatrixWorld();
          live.current.publish();
        });
      }
    }
    publish();
  }, [action, camera, dollyStep, frameDistance, motion, objects, publish, size.height, size.width]);

  useCanvasGestures({ camera, gl, surfaceRef, objects, live, motion, dollyStep });

  return null;
}
