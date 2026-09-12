import type { PinPosition, Thread } from '../shared/types';

type Props = {
  positions: PinPosition[];
  /** Every thread, even where only some are drawn: the number shown comes from a thread's place in
   *  this list, so passing a filtered one would rename the same conversation per view. */
  threads: Thread[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

// Geometry only. Size and offset are mirrored by PIN in projectPins.ts, which clamps pins to the frame.
const pinShape = 'comment-pin absolute grid size-9 place-items-center -translate-x-[5px] -translate-y-[31px]'
  + ' rounded-[50%_50%_50%_5px] border-2 border-surface text-xs font-bold';

// Pins remain HTML buttons so their hit targets and keyboard behavior do not shrink with the scene.
export function CommentPins({ positions, threads, selectedId, onSelect }: Props) {
  return <div className="pointer-events-none absolute inset-0 overflow-hidden">
    {positions.map((position) => {
      const index = threads.findIndex((thread) => thread.id === position.id);
      const thread = threads[index];
      if (!position.visible) return null;
      if (position.id === 'draft') return <span key="draft" className={`${pinShape} bg-[#cb8252] text-xl text-surface`} style={{ left: position.x, top: position.y }} aria-label="New comment location">+</span>;
      if (!thread) return null;
      const resolved = thread.resolved;
      return <button
        key={thread.id}
        className={`${pinShape} pointer-events-auto cursor-pointer shadow-[0_3px_10px_#213f3925] transition-colors active:brightness-90
          focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#416d54]
          ${resolved ? 'border-[#b9c5aa] bg-[#f9faf4] text-[#547348] hover:border-[#789366] hover:bg-[#e8efdb]' : 'bg-pin text-surface hover:bg-[#173e2c] hover:shadow-[0_3px_12px_#213f3955]'}
          ${/* Dimmed, not hidden: the surface faces away but the conversation still exists, and a
                pin that vanishes is how a comment comes to look lost. */ ''}
          ${position.occluded ? 'opacity-40 shadow-none hover:opacity-100' : ''}
          ${selectedId === thread.id ? 'z-20 outline-[3px] outline-offset-[3px] outline-[#bfcf9a]' : ''}`}
        style={{ left: position.x, top: position.y }}
        aria-label={`Open comment ${index + 1} by ${thread.messages[0].author}`}
        aria-pressed={selectedId === thread.id}
        title={position.occluded ? `On the far side: ${thread.messages[0].text}` : thread.messages[0].text}
        onClick={() => onSelect(thread.id)}
      >
        {resolved ? '✓' : index + 1}
      </button>;
    })}
  </div>;
}
