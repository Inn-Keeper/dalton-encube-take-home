import { useState } from 'react';
import type { Thread } from '../shared/types';
import { ThreadEditor } from './ThreadEditor';
import { ThreadMessage } from './ThreadMessage';
import { DeleteMessageDialog } from './DeleteMessageDialog';
import { isEmptyConversation } from './threadModel';
import { accentedBlock, conversationBlock } from './layout';
import { quietButton, statusLabel } from '../shared/ui';

type ConversationProps = {
  thread: Thread;
  /** True while unsaved text exists anywhere in the panel; a second editor would discard it. */
  locked: boolean;
  onReply: (threadId: string, text: string) => void;
  onEdit: (threadId: string, messageId: string, text: string) => void;
  onDelete: (threadId: string, messageId: string) => void;
  onDeleteConversation: (threadId: string) => void;
  onResolve: (id: string) => void;
  onDirtyChange: (dirty: boolean) => void;
};

// The open thread: a resolution control, its messages, and exactly one editor at a time.
export function Conversation({ thread, locked, onReply, onEdit, onDelete, onDeleteConversation, onResolve, onDirtyChange }: ConversationProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingConversation, setDeletingConversation] = useState(false);
  const deletingIndex = thread.messages.findIndex((message) => message.id === deletingId);
  const empty = isEmptyConversation(thread);

  // Leaving edit mode restores the reply composer, which shares the editor slot.
  function finishEditing() { setEditingId(null); }

  return (
    // The accent matches the pin colour, so one colour means "this is the selected conversation"
    // whether you are looking at the canvas, the list, or the panel.
    <section className={`active-conversation ${conversationBlock} ${accentedBlock}`} aria-label="Selected conversation">
      {deletingId && deletingIndex >= 0 && (
        <DeleteMessageDialog
          kind={deletingIndex === 0 ? 'comment' : 'reply'}
          onCancel={() => setDeletingId(null)}
          onConfirm={() => { onDelete(thread.id, deletingId); setDeletingId(null); }}
        />
      )}
      {deletingConversation && (
        <DeleteMessageDialog
          kind="conversation"
          onCancel={() => setDeletingConversation(false)}
          onConfirm={() => onDeleteConversation(thread.id)}
        />
      )}
      <div className="mb-5 flex items-center justify-between gap-2.5">
        <span className={`${statusLabel} ${thread.resolved ? 'text-[#577557]' : 'text-[#76664d]'}`}>{thread.resolved ? 'Resolved' : 'Open conversation'}</span>
        <div className="flex items-center gap-2">
          <button type="button" className={`${quietButton} text-clay`} disabled={locked} onClick={() => setDeletingConversation(true)}>Delete</button>
          {/* Resolving leaves the editor mounted, so it stays available even with unsaved text. */}
          <button type="button" className={quietButton} title={thread.resolved ? 'Reopen this conversation for replies' : 'Mark settled and stop accepting replies'} onClick={() => onResolve(thread.id)}>{thread.resolved ? 'Reopen' : 'Resolve'}</button>
        </div>
      </div>
      <ol className="m-0 list-none p-0">
        {thread.messages.map((message, index) => (
          <ThreadMessage
            key={message.id}
            message={message}
            isRoot={index === 0}
            editing={editingId === message.id}
            locked={locked}
            onStartEditing={() => setEditingId(message.id)}
            onDelete={() => setDeletingId(message.id)}
            onSave={(text) => { onEdit(thread.id, message.id, text); finishEditing(); }}
            onCancel={finishEditing}
            onDirtyChange={onDirtyChange}
          />
        ))}
      </ol>
      {empty && <p className="mt-4 rounded-md border border-dashed border-[#d9ddd1] bg-[#f6f6f0] px-3 py-2.5 text-xs text-muted">Empty conversation</p>}
      {/* A resolved conversation is closed to new replies: reopening is the deliberate way back in,
          which keeps "resolved" meaning settled rather than merely labelled. The exception is
          unsaved text, since resolving mid-sentence must not silently destroy what was typed.
          Cancelling a reply only clears its field, so the conversation stays open. */}
      {thread.resolved && !locked ? (
        <p className="mt-5 rounded-md border border-[#dfe3d6] bg-[#f2f4ec] px-3 py-2.5 text-xs text-muted">This conversation is resolved. Reopen it to reply.</p>
      ) : editingId === null && (
        <ThreadEditor key="reply" label="Add a reply" saveLabel="Reply" onSave={(text) => onReply(thread.id, text)} onDirtyChange={onDirtyChange} />
      )}
    </section>
  );
}
