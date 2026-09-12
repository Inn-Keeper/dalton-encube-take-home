import type { Thread } from '../shared/types';
import { MessageTime } from './MessageTime';
import { baseButton } from '../shared/ui';
import { isEmptyConversation } from './threadModel';

type ThreadSummaryProps = {
  thread: Thread;
  selected: boolean;
  /** Unsaved text elsewhere blocks switching away, but never blocks re-selecting this thread. */
  locked: boolean;
  onSelect: () => void;
};

// One row in the list: a single button, so keyboard users reach each thread in one tab stop.
export function ThreadSummary({ thread, selected, locked, onSelect }: ThreadSummaryProps) {
  const root = thread.messages[0];
  if (!root) return null;
  const preview = root.deleted ? (isEmptyConversation(thread) ? 'Empty conversation' : 'Comment deleted') : root.text;
  const replies = thread.messages.length - 1;
  return (
    <li>
      {/* The preview clamps to two lines, so hovering is the only way to read a long comment here. */}
      <button
        type="button"
        className={`thread-summary ${baseButton} block w-full rounded-lg border border-transparent px-2.5 py-3.5 text-left text-inherit
          hover:not-disabled:bg-[#f1f2e9]
          aria-current:animate-thread-reveal aria-current:border-pin aria-current:bg-sage`}
        title={locked && !selected ? 'Save or cancel your changes first' : preview}
        disabled={locked && !selected}
        aria-current={selected ? 'true' : undefined}
        onClick={onSelect}
      >
        <span className="flex items-center justify-between gap-2.5">
          <strong className="text-xs font-medium">{root.author}</strong>
          <span className={`inline-block size-1.5 shrink-0 rounded-full ${thread.resolved ? 'bg-[#7e9973]' : 'bg-amber'}`} aria-label={thread.resolved ? 'Resolved' : 'Open'} />
        </span>
        <span className="mt-2 line-clamp-2 text-xs/relaxed text-[#62685b] [overflow-wrap:anywhere]">{preview}</span>
        <span className="mt-[11px] flex items-center justify-between gap-2.5 text-2xs text-muted">
          <MessageTime message={root} />
          <span>{replies} {replies === 1 ? 'reply' : 'replies'}</span>
        </span>
      </button>
    </li>
  );
}
