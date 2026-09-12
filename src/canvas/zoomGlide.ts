// Shorter than the 260 ms layout transitions: those move a panel you are reading, this one answers
// a gesture, and a gesture that lags its input feels broken rather than smooth.
const DURATION = 220;

// Ease-out cubic: leaves immediately so the input feels answered, then settles instead of stopping dead.
function easeOut(progress: number) {
  return 1 - (1 - progress) ** 3;
}

function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Eases zoom toward a target instead of writing the camera straight from the input.
 *
 * The ease runs over the logarithm of the pending factor, so equal time spends equal proportion, and
 * each frame hands back a step rather than a distance, so the caller keeps applying it against its
 * own locked anchor. Fixed duration, not an exponential follow: a follow lands fractionally short,
 * which leaves the next ten-percent step computing a no-op.
 */
export class ZoomGlide {
  private frame = 0;
  private remaining = 1;
  private apply: ((step: number) => void) | null = null;

  /** How much zoom is still owed. Callers step from here, not from the camera, or a press during a
   *  glide would measure from a view that has not arrived yet. */
  get pending() {
    return this.remaining;
  }

  /** Add a factor to the target and ease into it. `step` is applied once per frame until it lands. */
  to(factor: number, step: (factor: number) => void) {
    this.remaining *= factor;
    this.apply = step;
    if (prefersReducedMotion()) {
      step(this.remaining);
      this.settle();
      return;
    }
    // A new input re-aims at the combined target and restarts the ease from wherever the view is.
    if (this.frame) cancelAnimationFrame(this.frame);
    const total = Math.log(this.remaining);
    const startedAt = performance.now();
    let applied = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / DURATION);
      const due = total * easeOut(progress);
      this.remaining = Math.exp(total - due);
      this.apply?.(Math.exp(due - applied));
      applied = due;
      if (progress < 1) {
        this.frame = requestAnimationFrame(tick);
        return;
      }
      this.settle();
    };
    this.frame = requestAnimationFrame(tick);
  }

  /** Panning, navigating and unmount all drop whatever zoom was still owed. */
  cancel() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.settle();
  }

  private settle() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.remaining = 1;
    this.apply = null;
  }
}
