import type { Message, Point3, Thread } from '../shared/types';

const KEY = 'encube.threads.v1';

// A parseable date, not merely a string: rendering formats it, and an unparseable one shows as
// "Invalid Date" rather than failing loudly.
function isMessage(value: unknown): value is Message {
  if (typeof value !== 'object' || value === null) return false;
  const message = value as Record<string, unknown>;
  return typeof message.id === 'string'
    && typeof message.author === 'string'
    && typeof message.createdAt === 'string' && Number.isFinite(Date.parse(message.createdAt))
    && typeof message.text === 'string'
    && (message.deleted === undefined || typeof message.deleted === 'boolean');
}

function isAnchor(value: unknown): value is Point3 {
  return Array.isArray(value) && value.length === 3 && value.every((axis) => typeof axis === 'number' && Number.isFinite(axis));
}

// Rendering needs a root message, not just fields with the right primitive types.
function isThread(value: unknown): value is Thread {
  if (typeof value !== 'object' || value === null) return false;
  const thread = value as Record<string, unknown>;
  return typeof thread.id === 'string'
    && isAnchor(thread.anchor)
    && (thread.on === undefined || typeof thread.on === 'string')
    && typeof thread.resolved === 'boolean'
    && Array.isArray(thread.messages) && thread.messages.length > 0 && thread.messages.every(isMessage);
}

// Null means "nothing usable stored", which callers treat differently from a deliberately empty board.
export function loadThreads(): Thread[] | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every(isThread) ? (parsed as Thread[]) : null;
  } catch {
    return null;
  }
}

// Private browsing and quota limits must degrade to an in-memory session, never break one.
export function saveThreads(threads: Thread[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(threads));
    return true;
  } catch {
    return false;
  }
}
