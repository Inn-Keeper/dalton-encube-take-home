import type { Vector2, Vector3 } from 'three';

type Target = { pointer: Vector2; anchor: Vector3 };

// Wheel has no end event, so a burst ends when nothing arrives for this long. Long enough to span
// native momentum, short enough that a fresh pinch picks a fresh target.
const IDLE_MS = 150;

// Retain one target through a burst, including native momentum.
export class ZoomGesture {
  private target: Target | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  // Only the first event chooses geometry; later events refresh the idle deadline.
  capture(create: () => Target) {
    this.target ??= create();
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.clear(), IDLE_MS);
    return this.target;
  }

  // Also used on blur, navigation changes, and unmount so no stale target can survive.
  clear() {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.target = null;
  }
}
