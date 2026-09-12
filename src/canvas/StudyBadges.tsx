import { studies } from './studies';
import type { PinPosition } from '../shared/types';

/** One control per board, opening that form on its own. It sits on the board rather than on the
 *  form so it never covers the surface people comment on, and never competes with a pin. */
export function StudyBadges({ positions, onInspect }: { positions: PinPosition[]; onInspect: (id: string) => void }) {
  return <div className="pointer-events-none absolute inset-0 overflow-hidden">
    {positions.map((position) => {
      const study = studies.find((item) => item.id === position.id);
      if (!study || !position.visible) return null;
      return <button
        key={study.id}
        type="button"
        className="study-badge pointer-events-auto absolute grid size-7 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center
          rounded-full border border-[#cfd6c4] bg-[#fffefad9] text-[#3d5647] shadow-[0_2px_8px_#213f3920] backdrop-blur-[2px] transition-colors
          hover:border-pin hover:bg-surface hover:text-pin active:brightness-95
          focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#416d54]"
        data-study={study.id}
        style={{ left: position.x, top: position.y }}
        title={`Open ${study.label} on its own and turn it`}
        aria-label={`Inspect ${study.label}`}
        onClick={() => onInspect(study.id)}
      >
        {/* A cube, not a circular arrow: that read as "refresh" rather than "open this object". */}
        <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4 fill-none stroke-current stroke-[1.3] [stroke-linecap:round] [stroke-linejoin:round]">
          <path d="M8 1.6 14 5v6l-6 3.4L2 11V5Zm0 0v5.1m6-1.7L8 6.7 2 5m6 1.7v7.7" />
        </svg>
      </button>;
    })}
  </div>;
}
