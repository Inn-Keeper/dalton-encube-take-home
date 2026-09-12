import type { Filter, Thread } from '../shared/types';
import { ThreadSummary } from './ThreadSummary';
import { baseButton } from '../shared/ui';

const filters: Filter[] = ['all', 'open', 'resolved'];

type ThreadListProps = {
  threads: Thread[];
  selectedId: string | null;
  filter: Filter;
  /** Unsaved text elsewhere disables navigating away, so the list reflects that state. */
  locked: boolean;
  onFilter: (filter: Filter) => void;
  onSelect: (id: string) => void;
};

// Filtering only narrows this list; the open conversation above it stays mounted and editable.
export function ThreadList({ threads, selectedId, filter, locked, onFilter, onSelect }: ThreadListProps) {
  const visible = threads.filter((thread) => filter === 'all' || (filter === 'resolved') === thread.resolved);
  // Outstanding work is the number people act on, so it is worth reading without switching filters.
  const openCount = threads.filter((thread) => !thread.resolved).length;
  return (
    <>
      <div className="px-panel pt-[22px] pb-3">
        <h3 className="mt-0 mb-3 text-2xs font-semibold tracking-widest uppercase text-muted">Conversations</h3>
        {/* Pressed buttons rather than tabs: these filter a list, they do not switch panels. */}
        <div className="flex gap-[3px] rounded-[7px] bg-[#eeeee6] p-[3px]" aria-label="Filter conversations">
          {filters.map((value) => (
            <button
              key={value}
              type="button"
              className={`${baseButton} flex flex-1 items-center justify-center gap-1.5 rounded-[5px] border-0 bg-transparent px-2.5 py-[7px] text-xs text-muted aria-pressed:bg-surface aria-pressed:text-[#384734] aria-pressed:shadow-[0_1px_3px_#333a2910]`}
              title={value === 'all' ? 'Show every conversation' : value === 'open' ? 'Show conversations still awaiting a decision' : 'Show conversations marked settled'}
              aria-pressed={filter === value}
              onClick={() => onFilter(value)}
            >
              {value.charAt(0).toUpperCase() + value.slice(1)}
              {/* Left in the accessible name rather than hidden: "Open 3" is what the badge means. */}
              {/* Amber, the same colour the list already uses for an unresolved thread's dot. */}
              {value === 'open' && openCount > 0 && <span className="min-w-4 rounded-full bg-amber-deep px-1.5 py-px text-center text-2xs tabular-nums text-white">{openCount}</span>}
            </button>
          ))}
        </div>
      </div>
      <ol className="m-0 list-none px-3 pt-0 pb-4 *:not-first:mt-1">
        {visible.map((thread) => (
          <ThreadSummary key={thread.id} thread={thread} selected={thread.id === selectedId} locked={locked} onSelect={() => onSelect(thread.id)} />
        ))}
      </ol>
      {visible.length === 0 && (
        <p className="mx-panel mt-[3px] mb-7 text-xs/loose text-[#777d6c]">
          {filter === 'all' ? 'Choose Comment, then click anywhere on the canvas to start a conversation.' : `No ${filter} conversations yet.`}
        </p>
      )}
    </>
  );
}
