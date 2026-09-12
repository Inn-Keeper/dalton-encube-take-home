import { MathUtils, Object3D, PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from 'three';
import type { DollyLimits, Point3, Viewport } from '../shared/types';

// Convert viewport-local CSS pixels into a camera ray, independent of Retina backing resolution.
function pointerRay(point: Vector2, camera: PerspectiveCamera, view: Viewport) {
  camera.updateMatrixWorld();
  const ray = new Raycaster();
  ray.setFromCamera(new Vector2(point.x / view.width * 2 - 1, 1 - point.y / view.height * 2), camera);
  return ray;
}

// A view-parallel plane gives empty space and a locked zoom gesture an unambiguous depth.
export function pointOnPlane(point: Vector2, z: number, camera: PerspectiveCamera, view: Viewport) {
  return pointerRay(point, camera, view).ray.intersectPlane(
    new Plane(new Vector3(0, 0, 1), -z), new Vector3(),
  );
}

// Forms are the only things that ever move, so they are the only things needing their own space.
function formOf(object: Object3D | null): Object3D | null {
  for (let node = object; node; node = node.parent) if (node.name.startsWith('form-')) return node;
  return null;
}

/** Where a click lands: the world point, and the form whose space its anchor belongs in. */
export type Hit = { point: Vector3; form: Object3D | null };

// Surface hits prevent perspective parallax from separating feedback from the clicked object.
export function anchorAt(point: Vector2, camera: PerspectiveCamera, view: Viewport, objects: Object3D[]): Hit {
  const ray = pointerRay(point, camera, view);
  const hit = ray.intersectObjects(objects, true)[0];
  if (hit) return { point: hit.point, form: formOf(hit.object) };
  // Empty space still needs a depth, and the review plane is what the scene is built around.
  return { point: ray.ray.intersectPlane(new Plane(new Vector3(0, 0, 1), 0), new Vector3())!, form: null };
}

/** Store an anchor against the form it landed on, so it travels with that surface. */
export function toAnchor(hit: Hit): { anchor: Point3; on?: string } {
  const local = hit.form ? hit.form.worldToLocal(hit.point.clone()) : hit.point.clone();
  return { anchor: local.toArray(), on: hit.form?.name };
}

/** Resolve a stored anchor inside whichever scene graph is rendering it. The canvas and the
 *  inspector each hold their own copy of a form, and both find it by the same name. */
export function anchorWorld({ anchor, on }: { anchor: Point3; on?: string }, root: Object3D | null) {
  const point = new Vector3(...anchor);
  const form = on ? root?.getObjectByName(on) : null;
  return form ? form.localToWorld(point) : point;
}

// HTML pins use CSS pixels while their stored locations stay in world space.
export function projectPoint(point: Vector3, camera: PerspectiveCamera, view: Viewport) {
  camera.updateMatrixWorld();
  const ndc = point.clone().project(camera);
  return {
    x: (ndc.x + 1) * view.width / 2,
    y: (1 - ndc.y) * view.height / 2,
    visible: Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && ndc.z >= -1 && ndc.z <= 1,
  };
}

// Clamp first, then correct laterally so the locked world target stays beneath the pointer.
export function dollyAt(camera: PerspectiveCamera, pointer: Vector2, anchor: Vector3, factor: number, view: Viewport, limits: DollyLimits) {
  // A shrinking viewport can drop max below the camera, so never let zooming out pull it inward.
  camera.position.z = MathUtils.clamp(camera.position.z * factor, limits.min, Math.max(limits.max, camera.position.z));
  const after = pointOnPlane(pointer, anchor.z, camera, view);
  if (after) {
    camera.position.x += anchor.x - after.x;
    camera.position.y += anchor.y - after.y;
  }
  camera.updateMatrixWorld();
}

// Wheel pans at the review plane; pointer drags use their grabbed depth to avoid surface slippage.
export function panCamera(camera: PerspectiveCamera, x: number, y: number, height: number, depth = 0) {
  const unitsPerPixel = 2 * (camera.position.z - depth) * Math.tan(MathUtils.degToRad(camera.fov / 2)) / height;
  camera.position.x += x * unitsPerPixel;
  camera.position.y -= y * unitsPerPixel;
  camera.updateMatrixWorld();
}

/** Where the review plane sits on screen and how big a world unit is there. The background grid is
 *  drawn from this, so it belongs to the world rather than floating over it. */
export function reviewPlaneView(camera: PerspectiveCamera, view: Viewport) {
  const origin = projectPoint(new Vector3(0, 0, 0), camera, view);
  const pixelsPerUnit = view.height / (2 * camera.position.z * Math.tan(MathUtils.degToRad(camera.fov / 2)));
  return { x: origin.x, y: origin.y, pixelsPerUnit };
}

// Ten-percent stops, stepped away from the current value: a fixed multiplier drifts to 144% and
// 173%. ARRIVED counts a view that eased to within half a percent as already on its stop, or the
// next press would ask for the stop it is on and nothing would move.
const STOP_PERCENT = 10;
const ARRIVED = 0.05;

export function nextZoomStop(percent: number, direction: 1 | -1) {
  const grid = percent / STOP_PERCENT;
  const next = direction > 0 ? Math.floor(grid + ARRIVED) + 1 : Math.ceil(grid - ARRIVED) - 1;
  return Math.max(STOP_PERCENT, next * STOP_PERCENT);
}

/** The factor that moves `current` to the next stop. Both views step this way, and both must
 *  measure from where the zoom is heading rather than where the camera is. */
export function zoomStepFactor(reference: number, current: number, direction: 1 | -1) {
  return reference * 100 / nextZoomStop(reference / current * 100, direction) / current;
}

// Stop the ray short so a point sitting exactly on a surface cannot occlude itself. A thousandth
// was inside floating-point noise at distance and pins blinked; a fiftieth is still far thinner
// than anything that could legitimately occlude one.
const SURFACE_TOLERANCE = 0.02;

export function isOccluded(point: Vector3, camera: PerspectiveCamera, objects: Object3D[]) {
  const direction = point.clone().sub(camera.position);
  const distance = direction.length();
  const ray = new Raycaster(camera.position, direction.normalize(), camera.near, Math.max(0, distance - SURFACE_TOLERANCE));
  return ray.intersectObjects(objects, true).length > 0;
}

// Sixteen pixels is an explicit line-unit tuning choice, not a Firefox identification rule.
const PIXELS_PER_LINE = 16;
const DELTA_LINE = 1;
const DELTA_PAGE = 2;

export function normalizeWheel(x: number, y: number, mode: number, view: Viewport) {
  const scale = (page: number) => mode === DELTA_LINE ? PIXELS_PER_LINE : mode === DELTA_PAGE ? page : 1;
  return [x * scale(view.width), y * scale(view.height)];
}
