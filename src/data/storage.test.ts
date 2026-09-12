import { afterEach, expect, it, vi } from 'vitest';
import { loadThreads } from './storage';
import { seedThreads } from './seed';

afterEach(() => vi.unstubAllGlobals());

it.each([
  { ...seedThreads[0], messages: [] },
  { ...seedThreads[0], messages: [{ ...seedThreads[0].messages[0], createdAt: 'garbage' }] },
])('rejects stored threads that cannot be rendered: %j', (thread) => {
  vi.stubGlobal('localStorage', { getItem: () => JSON.stringify([thread]) });
  expect(loadThreads()).toBeNull();
});

it.each([{ threads: seedThreads }, { threads: [] }])('loads usable data without confusing an empty board with invalid storage', ({ threads }) => {
  vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(threads) });
  expect(loadThreads()).toEqual(threads);
});
