import { PerspectiveCamera, Vector3, type Object3D } from 'three';
import { anchorWorld, isOccluded, projectPoint } from './coordinates';
import { studies } from './studies';
import type { Draft, PinPosition, Thread, Viewport } from '../shared/types';

// Mirrors .comment-pin in index.css: a 36px bubble drawn up and left so its tip lands on the anchor.
const PIN = { size: 36, offsetX: -5, offsetY: -31 };

// Hold a bubble against the edge rather than letting the frame clip it; max wins on tiny viewports.
function clampToFrame(value: number, offset: number, extent: number) {
  return Math.min(Math.max(value, -offset), Math.max(-offset, extent - PIN.size - offset));
}

// Project saved and draft anchors together so clipping and surface occlusion follow identical rules.
// `root` is the scene graph doing the rendering, so the canvas and the inspector share this one
// function and each resolves form-local anchors through its own copy of the form.
export function projectPins(threads: Thread[], draft: Draft | null, camera: PerspectiveCamera, root: Object3D | null, objects: Object3D[], view: Viewport): PinPosition[] {
  const anchors: (Draft & { id: string })[] = threads.map(({ id, anchor, on }) => ({ id, anchor, on }));
  if (draft) anchors.push({ ...draft, id: 'draft' });
  return anchors.map(({ id, ...stored }) => {
    const point = anchorWorld(stored, root);
    const projected = projectPoint(point, camera, view);
    return {
      id,
      x: clampToFrame(projected.x, PIN.offsetX, view.width),
      y: clampToFrame(projected.y, PIN.offsetY, view.height),
      visible: projected.visible,
      occluded: isOccluded(point, camera, objects),
    };
  });
}

// Inspect controls ride on their board, so they follow the camera exactly as pins do. They are not
// clamped to the frame: a badge belongs to one board, and holding it at the edge would detach it.
export function projectBadges(camera: PerspectiveCamera, objects: Object3D[], view: Viewport): PinPosition[] {
  return studies.map((study) => {
    const point = new Vector3(...study.badge);
    const projected = projectPoint(point, camera, view);
    return { id: study.id, x: projected.x, y: projected.y, visible: projected.visible && !isOccluded(point, camera, objects), occluded: false };
  });
}
