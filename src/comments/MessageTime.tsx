import type { Message } from '../shared/types';

const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

// Render the original creation time in the reader's own timezone, machine-readable for assistive tech.
export function MessageTime({ message }: { message: Message }) {
  return <time className="text-2xs text-muted" dateTime={message.createdAt}>{dateFormat.format(new Date(message.createdAt))}</time>;
}
