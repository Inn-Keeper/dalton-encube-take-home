import { afterEach, expect, it, vi } from 'vitest';
import { Vector2, Vector3 } from 'three';
import { ZoomGesture } from './zoomGesture';

afterEach(() => vi.useRealTimers());

it('retains a target through momentum and releases after an idle gap', () => {
  vi.useFakeTimers();
  const gesture = new ZoomGesture();
  const original = { pointer: new Vector2(100, 50), anchor: new Vector3(1, 2, 3) };
  expect(gesture.capture(() => original)).toBe(original);
  vi.advanceTimersByTime(140);
  expect(gesture.capture(() => { throw new Error('must not raycast again'); })).toBe(original);
  vi.advanceTimersByTime(151);
  const next = { pointer: new Vector2(400, 50), anchor: new Vector3(5, 2, 0) };
  expect(gesture.capture(() => next)).toBe(next);
  gesture.clear();
  expect(vi.getTimerCount()).toBe(0);
});

it('clears a locked target and timer when another navigation action takes over', () => {
  vi.useFakeTimers();
  const gesture = new ZoomGesture();
  gesture.capture(() => ({ pointer: new Vector2(), anchor: new Vector3() }));
  gesture.clear();
  expect(vi.getTimerCount()).toBe(0);
  const next = { pointer: new Vector2(3, 2), anchor: new Vector3(9, 1, 0) };
  expect(gesture.capture(() => next)).toBe(next);
  gesture.clear();
});
