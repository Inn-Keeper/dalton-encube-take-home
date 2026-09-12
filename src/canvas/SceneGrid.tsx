import type { PlaneView } from '../shared/types';

// A step is chosen so the bar stays legible: too fine and it is noise, too coarse and it stops
// telling you anything. These are the 1-2-5 steps rulers and charts have always used.
const STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50];
const TARGET_WIDTH_PX = 110;
const MINOR_PER_STEP = 5;
// Light lines on the dark ground, kept to a whisper: enough to judge motion and scale against,
// never enough to compete with the forms. The minor lines stay well under the major ones, or the
// grid flattens into one texture and stops telling the eye anything.
const MAJOR_LINE = '#ffffff14';
const MINOR_LINE = '#ffffff08';

/** The step whose on-screen width is closest to comfortable at this zoom. */
function chooseStep(pixelsPerUnit: number) {
  return STEPS.reduce((best, step) =>
    Math.abs(step * pixelsPerUnit - TARGET_WIDTH_PX) < Math.abs(best * pixelsPerUnit - TARGET_WIDTH_PX) ? step : best);
}

function format(step: number) {
  return step < 1 ? step.toFixed(step < 0.5 ? 2 : 1) : String(step);
}

/**
 * A grid tied to the review plane rather than to the screen, so it pans and zooms with the scene and
 * gives the eye something to judge motion against. The bar reads out what one square measures, which
 * is the part that makes the grid worth drawing at all.
 */
export function SceneGrid({ plane }: { plane: PlaneView }) {
  const step = chooseStep(plane.pixelsPerUnit);
  const cell = step * plane.pixelsPerUnit;
  const minor = cell / MINOR_PER_STEP;
  return <>
    <div
      className="scene-grid pointer-events-none absolute inset-0"
      aria-hidden="true"
      style={{
        // Minor lines every fifth of a step keep the grid readable when the major squares are large.
        backgroundImage: `linear-gradient(${MAJOR_LINE} 1px, transparent 1px), linear-gradient(90deg, ${MAJOR_LINE} 1px, transparent 1px),
          linear-gradient(${MINOR_LINE} 1px, transparent 1px), linear-gradient(90deg, ${MINOR_LINE} 1px, transparent 1px)`,
        backgroundSize: `${cell}px ${cell}px, ${cell}px ${cell}px, ${minor}px ${minor}px, ${minor}px ${minor}px`,
        backgroundPosition: `${plane.x}px ${plane.y}px`,
      }}
    />
    <div className="scene-scale pointer-events-none absolute right-gutter bottom-[74px] z-20 flex flex-col items-end gap-1 max-stack:right-gutter-tight max-stack:bottom-[62px]">
      <span className="text-2xs tabular-nums text-on-canvas-muted">{format(step)} {step === 1 ? 'unit' : 'units'}</span>
      {/* The bar is the measurement; the number alone would mean nothing without its length. */}
      <span className="relative block h-1.5 border-x border-b border-[#8a949c]" style={{ width: cell }} />
    </div>
  </>;
}
