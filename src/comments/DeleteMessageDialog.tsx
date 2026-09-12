import { ConfirmDialog } from './ConfirmDialog';

export type DeleteKind = 'comment' | 'reply' | 'conversation';

// What survives differs by kind, and that is the only thing worth saying before a deletion. A map
// rather than a ternary chain: the next kind adds a line here instead of a branch in the markup.
const CONSEQUENCE: Record<DeleteKind, string> = {
  comment: 'Its replies and canvas pin will stay in this conversation.',
  reply: 'This reply will be permanently removed.',
  conversation: 'The conversation, every reply, and its canvas pin will be permanently removed.',
};

export function DeleteMessageDialog({ kind, onCancel, onConfirm }: { kind: DeleteKind; onCancel: () => void; onConfirm: () => void }) {
  return (
    <ConfirmDialog
      title={`Delete this ${kind}?`}
      description={CONSEQUENCE[kind]}
      cancelLabel="Cancel"
      confirmLabel={`Delete ${kind}`}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
