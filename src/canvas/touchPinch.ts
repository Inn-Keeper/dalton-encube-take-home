import { Vector2 } from 'three';

export type PinchChange = { midpoint: Vector2; factor: number };

/** Tracks exactly two touch pointers and reports incremental camera-distance factors. */
export class TouchPinch {
  private readonly points = new Map<number, Vector2>();
  private distance: number | null = null;

  get active() { return this.distance !== null; }

  down(id: number, point: Vector2) {
    if (this.points.size >= 2 && !this.points.has(id)) return null;
    this.points.set(id, point);
    if (this.points.size !== 2) return null;
    const [first, second] = [...this.points.values()];
    this.distance = first.distanceTo(second);
    return first.clone().add(second).multiplyScalar(0.5);
  }

  move(id: number, point: Vector2): PinchChange | null {
    if (!this.points.has(id)) return null;
    this.points.set(id, point);
    if (this.points.size !== 2 || this.distance === null) return null;
    const [first, second] = [...this.points.values()];
    const distance = first.distanceTo(second);
    if (distance === 0) return null;
    const factor = this.distance / distance;
    this.distance = distance;
    return { midpoint: first.clone().add(second).multiplyScalar(0.5), factor };
  }

  up(id: number) {
    const wasActive = this.points.has(id) && this.active;
    this.points.delete(id);
    if (this.points.size < 2) this.distance = null;
    return wasActive;
  }

  clear() {
    this.points.clear();
    this.distance = null;
  }
}
