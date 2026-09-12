import { describe, expect, it } from 'vitest';
import type { Thread } from '../shared/types';
import { isEmptyConversation, removeMessage } from './threadModel';

const thread: Thread = {
  id: 'thread', anchor: [0, 0, 0], resolved: false,
  messages: [
    { id: 'root', author: 'Maya', createdAt: '2026-09-12T10:00:00Z', text: 'Root' },
    { id: 'reply', author: 'Leo', createdAt: '2026-09-12T10:01:00Z', text: 'Reply' },
  ],
};

describe('conversation message removal', () => {
  it('removes a reply without changing the root', () => {
    expect(removeMessage(thread, 'reply').messages).toEqual([thread.messages[0]]);
  });

  it('clears and marks the root while preserving replies', () => {
    expect(removeMessage(thread, 'root').messages).toEqual([
      { ...thread.messages[0], text: '', deleted: true },
      thread.messages[1],
    ]);
  });

  it('recognizes only a deleted root without replies as empty', () => {
    expect(isEmptyConversation(removeMessage(removeMessage(thread, 'reply'), 'root'))).toBe(true);
    expect(isEmptyConversation(removeMessage(thread, 'root'))).toBe(false);
    expect(isEmptyConversation(thread)).toBe(false);
  });
});
