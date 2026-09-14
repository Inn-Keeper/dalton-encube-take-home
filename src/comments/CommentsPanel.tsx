import { useCallback, useEffect, useRef, useState } from 'react';
import type { Draft, Filter, Thread } from '../shared/types';
import { Conversation } from './Conversation';
import { ConfirmDialog } from './ConfirmDialog';
import { ThreadEditor } from './ThreadEditor';
import { ThreadList } from './ThreadList';
import { conversationBlock } from './layout';
import { baseButton, statusLabel } from '../shared/ui';

type CommentsPanelProps = {
  threads: Thread[];
  selectedId: string | null;
  draftAnchor: Draft | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  onCreate: (text: string) => void;
  onReply: (threadId: string, text: string) => void;
  onEdit: (threadId: string, messageId: string, text: string) => void;
  onDelete: (threadId: string, messageId: string) => void;
  onDeleteConversation: (threadId: string) => void;
  onResolve: (id: string) => void;
  onDirtyChange: (dirty: boolean) => void;
};

// Owns what the whole panel shares: which slot is open, whether text is unsaved, and how it closes.
// Rendering each region belongs to Conversation and ThreadList.
export function CommentsPanel({ threads, selectedId, draftAnchor, onSelect, onClose, onCreate, onReply, onEdit, onDelete, onDeleteConversation, onResolve, onDirtyChange }: CommentsPanelProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [dirty, setDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const dirtyCallback = useRef(onDirtyChange);
  const scrollArea = useRef<HTMLDivElement>(null);
  // Resolve the active thread from its id so the list filter can never hide the open conversation.
  const selected = threads.find((thread) => thread.id === selectedId);

  // Avoid replacing the editor callback when the parent updates unrelated state.
  useEffect(() => { dirtyCallback.current = onDirtyChange; }, [onDirtyChange]);

  // The conversation opens above the list, so a scrolled panel must return to it or the change is unseen.
  useEffect(() => {
    if (!selectedId && !draftAnchor) return;
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    scrollArea.current?.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  }, [selectedId, draftAnchor]);

  // One dirty guard serves both this panel's controls and the canvas navigation above it.
  const changeDirty = useCallback((nextDirty: boolean) => {
    setDirty(nextDirty);
    dirtyCallback.current(nextDirty);
  }, []);

  // Closing with unsaved text asks first; the dialog owns the decision, not this handler.
  const close = useCallback(() => {
    if (dirty) {
      setDiscardOpen(true);
      return;
    }
    changeDirty(false);
    onClose();
  }, [dirty, changeDirty, onClose]);

  // Clear the guard only once the author has explicitly confirmed losing their text.
  function discardChanges() {
    setDiscardOpen(false);
    changeDirty(false);
    onClose();
  }

  // Escape dismisses the open editor, deferring to the dialog and to IME composition.
  useEffect(() => {
    if (discardOpen || (!selectedId && !draftAnchor)) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.isComposing || event.keyCode === 229 || event.defaultPrevented) return;
      event.preventDefault();
      close();
    }
    document.addEventListener('keydown', handleEscape);
    return () => { document.removeEventListener('keydown', handleEscape); };
  }, [selectedId, draftAnchor, discardOpen, close]);

  return (
    // A fixed width keeps the content from reflowing while the collapsing column animates past it.
    <aside id="comments-panel" className="flex h-full min-h-0 w-[350px] flex-col border-l border-rule-soft bg-panel text-sm text-ink-soft max-panel:w-[310px] max-stack:w-full max-stack:border-l-0 max-stack:border-t max-stack:border-t-[#dfe3d8]" aria-label="Comments">
      {discardOpen && <ConfirmDialog
        title="Discard your changes?"
        description="Your unsaved text will be lost. You can keep editing to finish your thought."
        cancelLabel="Keep editing"
        confirmLabel="Discard changes"
        onCancel={() => setDiscardOpen(false)}
        onConfirm={discardChanges}
      />}
      <header className="flex items-start justify-between border-b border-[#e8e7df] px-panel pt-[26px] pb-[22px] max-stack:p-gutter-tight">
        <div>
          <h2 className="m-0 text-lg font-semibold tracking-[-.5px]">Comments <span className="ml-[7px] text-sm font-normal text-[#818277]">{threads.length}</span></h2>
          <p className="mt-[7px] text-xs text-muted">Thoughts, anchored in space.</p>
        </div>
        {(selected || draftAnchor) && <button type="button" className={`${baseButton} grid size-8 place-items-center rounded-full border border-[#dfdfd5] bg-transparent text-xl/none text-[#65675e] hover:bg-[#eeeee6]`} onClick={close} title="Close conversation (Esc)" aria-label="Close conversation">×</button>}
      </header>
      <div className="comments-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]" ref={scrollArea}>
        {draftAnchor ? (
          <section className={`new-conversation ${conversationBlock}`}>
            <span className={`${statusLabel} text-[#76664d]`}>New conversation</span>
            <ThreadEditor key="new" autoFocus label="Your comment" saveLabel="Post comment" onSave={onCreate} onCancel={onClose} onDirtyChange={changeDirty} />
          </section>
        ) : selected ? (
          // Keyed by thread so switching remounts the editor and replays the entry animation.
          <Conversation key={selected.id} thread={selected} locked={dirty} onReply={onReply} onEdit={onEdit} onDelete={onDelete} onDeleteConversation={onDeleteConversation} onResolve={onResolve} onDirtyChange={changeDirty} />
        ) : null}
        <ThreadList threads={threads} selectedId={selectedId} filter={filter} locked={dirty} onFilter={setFilter} onSelect={onSelect} />
      </div>
      <footer className="flex items-center gap-[7px] border-t border-[#e5e5db] px-panel py-3.5 text-2xs text-muted max-stack:px-gutter-tight max-stack:py-2.5"><span className="inline-block size-[5px] shrink-0 rounded-full bg-[#a2aa92]" /> Local demo · Fictional seed conversations</footer>
    </aside>
  );
}
