// Ease-out cubic: leaves immediately so the click feels answered, then settles instead of stopping dead.
function easeOut(progress: number) {
  return 1 - (1 - progress) ** 3;
}

// Reduced-motion users get the destination, never a moving camera.
function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// One tween at a time: navigating is a single intent, so a stale run must never fight a newer one.
export class CameraTween {
  private frame = 0;

  // `apply` receives eased progress from 0 to 1 and is always called a final time with exactly 1.
  run(duration: number, apply: (progress: number) => void) {
    this.cancel();
    if (duration <= 0 || prefersReducedMotion()) {
      apply(1);
      return;
    }
    const startedAt = performance.now();
    const tick = (now: number) => {
      const elapsed = Math.min(1, (now - startedAt) / duration);
      apply(easeOut(elapsed));
      this.frame = elapsed < 1 ? requestAnimationFrame(tick) : 0;
    };
    this.frame = requestAnimationFrame(tick);
  }

  // Direct manipulation, a newer navigation, and unmount all take the camera back immediately.
  cancel() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }
}
