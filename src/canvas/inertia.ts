// Below this the movement is invisible and only costs frames, so the glide ends there.
const STOP = 0.02;
// Per-frame decay at 60fps. Lower stops abruptly; higher drifts long enough to feel loose.
const DECAY = 0.9;
// A gesture's last samples matter most, but one stuttered frame should not define the throw.
const SMOOTHING = 0.3;

function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Carries a drag's speed a little past the release, so a gesture settles instead of stopping dead.
 * Shared by canvas panning and the inspector's turntable: both are direct manipulation that should
 * feel weighted, and both need the same "a newer gesture wins" rule.
 */
export class Inertia {
  private frame = 0;
  private velocity = { x: 0, y: 0 };
  private sampledAt = 0;

  /** Feed every movement of the live gesture, in pixels since the previous one. */
  track(x: number, y: number) {
    const now = performance.now();
    // Per-frame units, not per-millisecond: the glide below also steps once per frame.
    const elapsed = Math.max(1, now - this.sampledAt);
    const scale = Math.min(2, 16.7 / elapsed);
    this.velocity = {
      x: this.velocity.x * (1 - SMOOTHING) + x * scale * SMOOTHING,
      y: this.velocity.y * (1 - SMOOTHING) + y * scale * SMOOTHING,
    };
    this.sampledAt = now;
  }

  /** Continue the gesture under its own momentum. `step` receives the same deltas a move would. */
  release(step: (x: number, y: number) => void) {
    this.cancel();
    if (prefersReducedMotion()) return this.reset();
    let { x, y } = this.velocity;
    this.reset();
    const tick = () => {
      x *= DECAY;
      y *= DECAY;
      if (Math.abs(x) < STOP && Math.abs(y) < STOP) return this.cancel();
      step(x, y);
      this.frame = requestAnimationFrame(tick);
    };
    if (Math.abs(x) >= STOP || Math.abs(y) >= STOP) this.frame = requestAnimationFrame(tick);
  }

  /** A new gesture, a navigation, or unmount all take control back immediately. */
  cancel() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  reset() {
    this.velocity = { x: 0, y: 0 };
    this.sampledAt = performance.now();
  }
}
