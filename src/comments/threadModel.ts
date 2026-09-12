import type { Thread } from '../shared/types';

export function removeMessage(thread: Thread, messageId: string): Thread {
  const isRoot = thread.messages[0]?.id === messageId;
  return {
    ...thread,
    messages: isRoot
      ? thread.messages.map((message) => message.id === messageId ? { ...message, text: '', deleted: true } : message)
      : thread.messages.filter((message) => message.id !== messageId),
  };
}

export function isEmptyConversation(thread: Thread) {
  return thread.messages.length === 1 && thread.messages[0]?.deleted === true;
}
