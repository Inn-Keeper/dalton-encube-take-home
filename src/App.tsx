import { useCallback, useEffect, useRef, useState } from 'react';
import { Scene } from './canvas/Scene';
import { Kbd } from './shared/Kbd';
import { CommentsPanel } from './comments/CommentsPanel';
import { removeMessage } from './comments/threadModel';
import { currentUser, seedThreads } from './data/seed';
import { loadThreads, saveThreads } from './data/storage';
import { quietButton } from './shared/ui';
import { useFullscreen } from './shared/useFullscreen';
import type { CameraAction, Draft, Message, Mode, Thread } from './shared/types';

// New messages get immutable authorship and creation time; edits change text only.
function newMessage(text: string): Message {
  return { id: crypto.randomUUID(), author: currentUser, createdAt: new Date().toISOString(), text: text.trim() };
}

// Own the shared conversation state while keeping scene interaction and form editing independent.
export default function App() {
  // Seed only when nothing usable is stored, so a deliberately emptied board stays empty on reload.
  const [threads, setThreads] = useState<Thread[]>(() => loadThreads() ?? seedThreads);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftAnchor, setDraftAnchor] = useState<Draft | null>(null);
  // Start in Comment mode so a first canvas click leaves feedback; dragging still pans in either mode.
  const [mode, setMode] = useState<Mode>('comment');
  const [dirty, setDirty] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const fullscreen = useFullscreen();
  // The viewport changes size in one jump, so the workspace fades back in over the same .26s as
  // the sidebar and the conversation entry rather than snapping to its new dimensions.
  const [settling, setSettling] = useState(false);
  const firstFullscreen = useRef(true);
  const [notice, setNotice] = useState('');
  const [storageFailed, setStorageFailed] = useState(false);
  // Actions change the panel silently for a screen reader, so each one announces its own result.
  const [announcement, setAnnouncement] = useState('');
  const [action, setAction] = useState<CameraAction | null>(null);
  const actionId = useRef(0);
  const focusReturn = useRef<HTMLElement | null>(null);
  const panTool = useRef<HTMLButtonElement>(null);
  const commentTool = useRef<HTMLButtonElement>(null);
  const commentsToggle = useRef<HTMLButtonElement>(null);
  const previousThreads = useRef(threads);

  // Immutable thread changes trigger saving; Strict Mode's effect replay sees the same array and skips it.
  useEffect(() => {
    if (previousThreads.current === threads) return;
    previousThreads.current = threads;
    setStorageFailed(!saveThreads(threads));
  }, [threads]);

  // Single-key tools match the canvas conventions reviewers expect; typing must never trigger them.
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return;
      if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? '')) return;
      // Fullscreen belongs to the whole workspace, so its key is not scoped to the canvas the way
      // reset and zoom are. A real key press carries the user activation the browser requires.
      if (/^[fF]$/.test(event.key)) {
        event.preventDefault();
        fullscreen.toggle();
        return;
      }
      const next = /^[cC]$/.test(event.key) ? 'comment' : /^[vV]$/.test(event.key) ? 'pan' : null;
      if (!next) return;
      setMode(next);
      // A keystroke flips the browser to keyboard modality, so a ring appears on whatever holds
      // focus. Left on the previous tool it reads as the wrong selection, so move it with the mode.
      // Only when a tool already had focus: stealing it from the canvas would kill arrow-key panning.
      const tools: (HTMLButtonElement | null)[] = [panTool.current, commentTool.current];
      if (tools.includes(document.activeElement as HTMLButtonElement)) {
        (next === 'pan' ? panTool : commentTool).current?.focus();
      }
    }
    document.addEventListener('keydown', shortcut);
    return () => { document.removeEventListener('keydown', shortcut); };
  }, [fullscreen.toggle]);

  // Two frames: the dimmed state has to be painted before clearing it can transition back.
  useEffect(() => {
    if (firstFullscreen.current) { firstFullscreen.current = false; return; }
    setSettling(true);
    let frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => setSettling(false)); });
    return () => { cancelAnimationFrame(frame); };
  }, [fullscreen.active]);

  // Clear a navigation warning when saving or cancelling releases its dirty guard.
  const reportDirty = useCallback((value: boolean) => {
    setDirty(value);
    if (!value) setNotice('');
  }, []);

  // Camera requests are explicit events, separate from comment-state updates.
  const navigate = useCallback((kind: CameraAction['kind'], anchor?: Draft) => {
    setAction({ id: ++actionId.current, kind, anchor });
  }, []);

  // Prevent accidental replacement of an unfinished composer from the canvas or list.
  const mayNavigate = useCallback(() => {
    if (!dirty) return true;
    setNotice('Save or cancel your changes before opening another conversation.');
    return false;
  }, [dirty]);

  // Remember the initiating control so closing the panel returns keyboard users to context.
  const rememberFocus = useCallback(() => {
    focusReturn.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, []);

  // Geometry and empty-space placement share the same draft lifecycle. Reveal the panel with them:
  // a click that opened an editor behind a collapsed panel would look like a click that did nothing.
  const place = useCallback((draft: Draft) => {
    if (!mayNavigate()) return;
    rememberFocus();
    setSelectedId(null);
    setDraftAnchor(draft);
    setPanelOpen(true);
    setNotice('');
  }, [mayNavigate, rememberFocus]);

  // Pin selection never moves the camera; list selection may reveal an offscreen anchor.
  const select = useCallback((id: string, reveal = false) => {
    if (id !== selectedId && !mayNavigate()) return;
    rememberFocus();
    setDraftAnchor(null);
    setSelectedId(id);
    setPanelOpen(true);
    setNotice('');
    const thread = threads.find((item) => item.id === id);
    if (reveal && thread) navigate('reveal', { anchor: thread.anchor, on: thread.on });
  }, [mayNavigate, navigate, rememberFocus, selectedId, threads]);

  // Restore focus only after the editor has unmounted and its originating control is available.
  const close = useCallback(() => {
    setSelectedId(null);
    setDraftAnchor(null);
    setDirty(false);
    setNotice('');
    requestAnimationFrame(() => {
      const target = focusReturn.current;
      if (target?.isConnected && target !== document.body) target.focus();
      else commentTool.current?.focus();
    });
  }, []);

  // Persist only valid submitted text; an abandoned draft never becomes an empty thread.
  function create(text: string) {
    if (!draftAnchor || !text.trim()) return;
    const thread: Thread = { id: crypto.randomUUID(), ...draftAnchor, resolved: false, messages: [newMessage(text)] };
    setThreads((current) => [...current, thread]);
    setDraftAnchor(null);
    setSelectedId(thread.id);
    setNotice('');
    setAnnouncement('Comment posted.');
  }

  // Append a reply without copying selection state or resetting the conversation.
  function reply(threadId: string, text: string) {
    if (!text.trim()) return;
    const message = newMessage(text);
    setThreads((current) => current.map((thread) => thread.id === threadId ? { ...thread, messages: [...thread.messages, message] } : thread));
    setAnnouncement('Reply added.');
  }

  // Editing preserves the original author and timestamp, including simulated seed messages.
  function edit(threadId: string, messageId: string, text: string) {
    if (!text.trim()) return;
    setThreads((current) => current.map((thread) => thread.id === threadId
      ? { ...thread, messages: thread.messages.map((message) => message.id === messageId ? { ...message, text: text.trim() } : message) }
      : thread));
    setAnnouncement('Changes saved.');
  }

  // The root is the conversation's anchor, so deleting it clears its content without removing the
  // thread or replies. Replies have no structural role and can be removed from the message list.
  function deleteMessage(threadId: string, messageId: string) {
    setThreads((current) => current.map((thread) => thread.id === threadId ? removeMessage(thread, messageId) : thread));
    setAnnouncement('Message deleted.');
  }

  function deleteConversation(threadId: string) {
    setThreads((current) => current.filter((thread) => thread.id !== threadId));
    setSelectedId((selected) => selected === threadId ? null : selected);
    setAnnouncement('Conversation deleted.');
    requestAnimationFrame(() => commentsToggle.current?.focus());
  }

  // Resolve and reopen update the same thread used by both pins and filtered lists.
  function resolve(id: string) {
    setThreads((current) => current.map((thread) => thread.id === id ? { ...thread, resolved: !thread.resolved } : thread));
    setAnnouncement(threads.find((thread) => thread.id === id)?.resolved ? 'Conversation reopened.' : 'Conversation resolved.');
  }

  // One shared shape for both toolbar tools; only the label, icon and shortcut differ.
  // `cursor-pointer` is explicit because Tailwind's reset gives buttons the default arrow; every
  // other control in the app inherits it from the shared button style in shared/ui.
  const toolClass = 'flex cursor-pointer items-center gap-2 rounded-md px-3.5 py-2 text-xs font-medium text-muted transition-colors'
    + ' hover:bg-[#f5f6ee] aria-pressed:bg-surface aria-pressed:text-[#254737] aria-pressed:shadow-[0_1px_3px_#293c3114]'
    + ' focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#416d54]';

  return <div className="flex h-dvh flex-col max-stack:h-auto max-stack:min-h-dvh">
    <header className="flex h-14 shrink-0 items-center gap-5 border-b border-rule bg-surface px-gutter max-stack:h-12 max-stack:gap-3 max-stack:px-gutter-tight">
      <div className="flex items-center gap-2 text-lg font-bold tracking-[-.8px] text-forest" aria-label="Encube">
        <svg viewBox="0 0 28 28" aria-hidden="true" className="size-5 fill-none stroke-current stroke-[1.7] [stroke-linejoin:round]"><path d="m14 2 11 6v12l-11 6-11-6V8Zm0 0v12m11-6-11 6L3 8m11 6v12" /></svg>
        <span>encube</span>
      </div>
      <span className="h-5 w-px bg-[#dedfd7] max-stack:hidden" />
      <div className="flex min-w-0 items-baseline gap-2.5">
        <span className="text-2xs font-bold tracking-[1.5px] text-muted max-panel:hidden">WORKSPACE / MATERIAL EXPLORATIONS</span>
        <h1 className="m-0 truncate text-sm font-medium tracking-[-.2px]">Form study <span className="ml-1.5 rounded px-1.5 py-px align-middle text-2xs tracking-[.3px] text-muted bg-[#f0f1e9] max-stack:hidden">v.01</span></h1>
      </div>
      <div className="ml-auto flex items-center gap-4 max-stack:gap-2.5">
        {/* Fullscreen removes the browser's own chrome, so the way out has to be said somewhere.
            The browser handles the key itself; this only tells you which one. */}
        {fullscreen.active && <span className="flex items-center gap-1.5 rounded-md bg-[#f0f1e9] px-2.5 py-1.5 text-2xs text-muted">
          Press <Kbd>Esc</Kbd> or <Kbd>F</Kbd> to leave fullscreen
        </span>}
        <span className="flex items-center gap-[7px] text-xs text-[#6b776a] max-stack:hidden"><i className="size-[5px] rounded-full bg-[#7e9568]" /> Local demo</span>
        <span className="grid size-7 place-items-center rounded-full bg-[#dce5cd] text-2xs font-bold text-[#546341] outline outline-[#dfe3d6]" title="Posting as Dalton">D</span>
      </div>
    </header>
    {storageFailed && <p role="alert" className="shrink-0 border-b border-[#e8d8b8] bg-[#fff7e8] px-6 py-3 text-xs text-[#755b31]">
      Browser storage is unavailable. Your changes are only kept in this tab and will be lost on reload.
    </p>}
    {/* Collapsing animates the column itself, so the canvas grows into the space rather than
        jumping once the panel has gone. Timing matches the conversation entry animation. */}
    <main className={`grid min-h-0 flex-1 transition-[grid-template-columns,opacity] duration-[.26s] ease-out max-stack:flex max-stack:flex-auto max-stack:flex-col
      ${settling ? 'opacity-55' : 'opacity-100'}
      ${panelOpen ? 'grid-cols-[minmax(0,1fr)_350px] max-panel:grid-cols-[minmax(0,1fr)_310px]' : 'grid-cols-[minmax(0,1fr)_0px] max-panel:grid-cols-[minmax(0,1fr)_0px]'}`}>
      <div className="relative flex min-h-0 min-w-0 flex-col max-stack:h-[62dvh] max-stack:min-h-[440px]">
        <div className="flex shrink-0 items-center justify-between px-gutter py-3 max-stack:px-gutter-tight max-stack:py-2.5">
          <div className="flex gap-[3px] rounded-[9px] border border-[#e0e3d8] bg-[#e9ebe3] p-1" role="group" aria-label="Canvas tools">
            <button ref={panTool} className={toolClass} title="Drag to move the canvas (V)" aria-label="Pan tool" aria-keyshortcuts="v" aria-pressed={mode === 'pan'} onClick={() => setMode('pan')}><span aria-hidden="true" className="text-lg/4">↔</span> Pan <Kbd>V</Kbd></button>
            <button ref={commentTool} className={toolClass} title="Click a form or empty space to leave a comment (C)" aria-label="Comment tool" aria-keyshortcuts="c" aria-pressed={mode === 'comment'} onClick={() => setMode('comment')}><svg viewBox="0 0 20 20" aria-hidden="true" className="size-4 fill-none stroke-current stroke-[1.4]"><path d="M4 3h12a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H8l-5 3V4a1 1 0 0 1 1-1Z" /></svg> Comment <Kbd>C</Kbd></button>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs tracking-[.2px] text-muted max-panel:hidden">4 objects <span className="px-[7px]">·</span> 3D canvas</span>
            {/* Lives on the canvas side so it stays reachable once the panel it controls is gone. */}
            {/* The label is explicit because the word itself is dropped on a phone, where the
                toolbar has no room for it; the name must stay the same at every width. */}
            <button ref={commentsToggle} type="button" className={`${quietButton} flex items-center gap-2`} title={panelOpen ? 'Hide the comments sidebar' : 'Show the comments sidebar'} aria-label="Comments" aria-expanded={panelOpen} aria-controls="comments-panel" onClick={() => setPanelOpen((open) => !open)}>
              <span className="max-stack:hidden">Comments</span>
              <span className="rounded bg-[#eceee4] px-1.5 py-px text-2xs text-muted">{threads.length}</span>
              <svg viewBox="0 0 16 16" aria-hidden="true" className={`size-3.5 fill-none stroke-current stroke-[1.6] transition-transform duration-[.26s] ease-out ${panelOpen ? '' : 'rotate-180'}`}><path d="m6 3 5 5-5 5" /></svg>
            </button>
          </div>
        </div>
        <Scene threads={threads} selectedId={selectedId} draft={draftAnchor} mode={mode} action={action} onPlace={place} onSelect={select} onAction={navigate} fullscreen={fullscreen} />
        <p className={`absolute inset-x-6 bottom-[78px] z-40 rounded-md border border-[#e8d8b8] bg-[#fff7e8] p-3 text-xs text-[#755b31] ${notice ? 'block' : 'hidden'}`} role="status">{notice}</p>
      </div>
      {/* The panel stays mounted so filters and unsaved text survive a collapse; `inert` is what
          actually removes it, since an overflow-clipped element is still focusable and announced. */}
      <div inert={!panelOpen} className={`overflow-hidden transition-[height,opacity] duration-[.26s] ease-out max-stack:h-[480px] ${panelOpen ? 'opacity-100' : 'opacity-0 max-stack:h-0'}`}>
        <CommentsPanel threads={threads} selectedId={selectedId} draftAnchor={draftAnchor} onSelect={(id) => select(id, true)} onClose={close} onCreate={create} onReply={reply} onEdit={edit} onDelete={deleteMessage} onDeleteConversation={deleteConversation} onResolve={resolve} onDirtyChange={reportDirty} />
      </div>
    </main>
    {/* Off-screen but announced: the visible result of these actions is elsewhere in the panel. */}
    <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
  </div>;
}
