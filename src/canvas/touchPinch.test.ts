import { describe, expect, it } from 'vitest';
import { Vector2 } from 'three';
import { TouchPinch } from './touchPinch';

describe('TouchPinch', () => {
  it('ignores a third contact without interrupting the active two-finger gesture', () => {
    const pinch = new TouchPinch();
    pinch.down(1, new Vector2(0, 0));
    pinch.down(2, new Vector2(10, 0));

    expect(pinch.down(3, new Vector2(5, 5))).toBeNull();
    expect(pinch.up(3)).toBe(false);
    expect(pinch.move(2, new Vector2(20, 0))?.factor).toBe(0.5);
  });
});
