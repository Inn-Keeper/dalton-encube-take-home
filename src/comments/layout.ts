// The draft composer and the open thread occupy the same slot, so they share padding and entry motion.
export const conversationBlock = 'animate-conversation-enter border-b border-rule-soft bg-surface px-panel py-5 max-stack:p-gutter-tight';

// The active conversation carries a 3px accent on its left edge. Its padding sheds those 3px so the
// text still lands on the panel gutter every other element uses; without this the block reads crooked.
export const accentedBlock = 'border-l-[3px] border-l-pin pl-[calc(var(--spacing-panel)-3px)] max-stack:pl-[calc(var(--spacing-gutter-tight)-3px)]';
