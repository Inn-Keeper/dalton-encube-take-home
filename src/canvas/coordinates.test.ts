import { describe, expect, it } from 'vitest';
import { BoxGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera, Vector2, Vector3 } from 'three';
import { anchorAt, dollyAt, isOccluded, normalizeWheel, panCamera, pointOnPlane, projectPoint } from './coordinates';

const SCREEN = { width: 900, height: 600 };

// Use a real perspective projection so broken matrix updates cannot hide behind mocks.
function camera() {
  const value = new PerspectiveCamera(35, 1.5, 0.1, 200);
  value.position.set(2, -1, 18);
  value.updateMatrixWorld();
  return value;
}

// Build opaque design geometry for surface placement and occlusion checks.
function box() {
  const mesh = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial());
  mesh.updateMatrixWorld();
  return mesh;
}

describe('world anchors and camera motion', () => {
  it('round-trips a surface-depth point through screen coordinates', () => {
    const view = camera();
    const point = new Vector3(3, 2, 1);
    const screen = projectPoint(point, view, SCREEN);
    const hit = pointOnPlane(new Vector2(screen.x, screen.y), 1, view, SCREEN);
    expect(hit?.distanceTo(point)).toBeLessThan(1e-9);
  });

  it('chooses an object surface before falling back to empty-space plane', () => {
    const view = camera();
    view.position.set(0, 0, 18);
    view.updateMatrixWorld();
    expect(anchorAt(new Vector2(450, 300), view, SCREEN, [box()]).point.z).toBeCloseTo(1);
    expect(anchorAt(new Vector2(20, 20), view, SCREEN, [box()]).point.z).toBeCloseTo(0);
  });

  it.each([0, 1.5])('keeps the pointer target fixed at depth %s through fractional and clamped dolly', (depth) => {
    const view = camera();
    const pointer = new Vector2(220, 170);
    const anchor = pointOnPlane(pointer, depth, view, SCREEN)!;
    for (const factor of [0.83, 0.7, 1000, 0.00001]) {
      dollyAt(view, pointer, anchor, factor, SCREEN, { min: 5, max: 60 });
      expect(view.position.z).toBeGreaterThanOrEqual(5);
      expect(view.position.z).toBeLessThanOrEqual(60);
      const after = projectPoint(anchor, view, SCREEN);
      expect(after.x).toBeCloseTo(pointer.x, 7);
      expect(after.y).toBeCloseTo(pointer.y, 7);
    }
  });

  it.each([0, 1.5])('pans by viewport pixels at grabbed depth %s without mutating anchors', (depth) => {
    const view = camera();
    const point = new Vector3(0, 0, depth);
    const before = projectPoint(point, view, SCREEN);
    panCamera(view, 60, -35, 600, depth);
    const after = projectPoint(point, view, SCREEN);
    expect(after.x - before.x).toBeCloseTo(-60);
    expect(after.y - before.y).toBeCloseTo(35);
    expect(point.toArray()).toEqual([0, 0, depth]);
  });

  it('hides anchors behind geometry but not their own surface', () => {
    const view = camera();
    view.position.set(0, 0, 18);
    view.updateMatrixWorld();
    const objects = [box()];
    expect(isOccluded(new Vector3(0, 0, 1), view, objects)).toBe(false);
    expect(isOccluded(new Vector3(0, 0, 0), view, objects)).toBe(true);
    view.position.x = 30;
    view.updateMatrixWorld();
    expect(isOccluded(new Vector3(-3, 0, 0), view, objects)).toBe(false);
  });

  it('normalizes declared wheel units instead of guessing the browser', () => {
    expect(normalizeWheel(3, -2, 0, SCREEN)).toEqual([3, -2]);
    expect(normalizeWheel(3, -2, 1, SCREEN)).toEqual([48, -32]);
    expect(normalizeWheel(1, -1, 2, SCREEN)).toEqual([900, -600]);
  });
});
