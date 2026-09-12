import { useState } from 'react';
import { focusRing } from '../shared/ui';
import type { Study } from './studies';

/**
 * The part sheet for the form under inspection: what it is, made of what, how big.
 *
 * Floats over the stage rather than docking beside it, so the form keeps the full width it was
 * opened to fill, and stays small for the same reason: zoomed in, the form reaches the corners.
 * Collapsible because the sheet is reference material, wanted while deciding what to say and in the
 * way while looking at the shape. Kept opaque rather than translucent, which would read as softer
 * but would put its text contrast at the mercy of whatever is rendered behind it.
 */
export function StudyInfo({ study }: { study: Study }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="study-info pointer-events-auto absolute top-4 left-gutter z-20 w-[204px] overflow-hidden rounded-lg border border-[#dfe3d7] bg-[#fffefaee] shadow-[0_3px_14px_#213f3914] backdrop-blur-[3px] max-stack:left-gutter-tight max-stack:w-[184px]">
      {/* The heading sits beside the toggle rather than inside it: a button may only contain
          phrasing content, and swallowing the heading would cost the card its place in the outline. */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div>
          <span className="block text-[9px] font-bold tracking-[1.1px] text-muted">SELECTED COMPONENT</span>
          <h2 className="mt-0.5 mb-0 text-xs font-medium tracking-[-.2px] text-ink">{study.label}</h2>
        </div>
        <button
          type="button"
          className={`grid size-6 shrink-0 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-muted transition-colors hover:bg-[#eeeee6] hover:text-ink ${focusRing}`}
          aria-expanded={open}
          aria-controls="study-details"
          aria-label="Part details"
          title={open ? 'Hide the part details' : 'Show the part details'}
          onClick={() => setOpen((shown) => !shown)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" className={`size-3.5 fill-none stroke-current stroke-[1.6] transition-transform duration-[.26s] ease-out ${open ? '' : '-rotate-90'}`}>
            <path d="m3 6 5 5 5-5" />
          </svg>
        </button>
      </div>
      {/* `hidden` rather than unmounted: the details keep their identity for `aria-controls`, and
          stay out of the tab order and the accessibility tree while closed. */}
      <div id="study-details" hidden={!open} className="border-t border-[#e8e9df] px-3 pt-2.5 pb-3">
        <span className="block text-[9px] tracking-[.4px] text-muted tabular-nums">{study.code}</span>
        {/* Three lines is enough to say what the form is for; the rest belongs in a comment. */}
        <p className="mt-2 mb-0 line-clamp-3 text-[10px]/snug text-[#61675a]">{study.description}</p>
        <dl className="mt-2.5 mb-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[10px]">
          {study.specs.map((spec) => (
            <div key={spec.label} className="col-span-2 grid grid-cols-subgrid">
              <dt className="text-muted">{spec.label}</dt>
              <dd className="m-0 text-right text-ink-soft tabular-nums">{spec.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
