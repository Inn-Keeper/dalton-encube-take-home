import type { Message } from '../shared/types';
import { MessageTime } from './MessageTime';
import { ThreadEditor } from './ThreadEditor';
import { linkButton } from '../shared/ui';

type ThreadMessageProps = {
  message: Message;
  /** The first message is the comment itself; the rest are replies, which changes every label. */
  isRoot: boolean;
  editing: boolean;
  /** True while any editor in the panel holds unsaved text, which blocks starting another one. */
  locked: boolean;
  onStartEditing: () => void;
  onDelete: () => void;
  onSave: (text: string) => void;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
};

// One message with its immutable author and timestamp, swapping to an editor in place when chosen.
export function ThreadMessage({ message, isRoot, editing, locked, onStartEditing, onDelete, onSave, onCancel, onDirtyChange }: ThreadMessageProps) {
  const kind = isRoot ? 'comment' : 'reply';

  return (
    <li className="[&+&]:mt-4 [&+&]:border-t [&+&]:border-[#eeede7] [&+&]:pt-4">
      <div>
        <div className="flex items-center gap-[7px] text-xs *:last:ml-auto">
          <span className="grid size-[26px] shrink-0 place-items-center rounded-full bg-[#e9e9df] text-xs text-[#686b5b]" aria-hidden="true">{message.author.charAt(0)}</span>
          <strong className="font-semibold">{message.author}</strong>
          <MessageTime message={message} />
        </div>
        {editing ? (
          <ThreadEditor autoFocus label={`Edit ${kind}`} initialText={message.text} saveLabel="Save" onSave={onSave} onCancel={onCancel} onDirtyChange={onDirtyChange} />
        ) : message.deleted ? (
          <p className="my-3 mb-[7px] text-xs italic text-muted">Comment deleted</p>
        ) : (
          <>
            <p className="message-text my-3 mb-[7px] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">{message.text}</p>
            <div className="flex items-center gap-3">
              <button type="button" className={linkButton} disabled={locked} onClick={onStartEditing} aria-label={`Edit ${kind} by ${message.author}`}>Edit</button>
              <button type="button" className={`${linkButton} text-clay`} disabled={locked} onClick={onDelete} aria-label={`Remove ${kind} by ${message.author}`}>Remove</button>
            </div>
          </>
        )}
      </div>
    </li>
  );
}
