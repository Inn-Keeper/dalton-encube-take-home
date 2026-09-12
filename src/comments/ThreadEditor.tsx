import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react';
import { primaryButton, quietButton, submitHint, submitShortcut } from '../shared/ui';

type ThreadEditorProps = {
  label: string;
  /** Only claim focus when typing is the intent. A reply box that appears merely because a thread
   *  was opened would capture the keyboard and kill the single-key canvas shortcuts. */
  autoFocus?: boolean;
  initialText?: string;
  saveLabel: string;
  onSave: (text: string) => void;
  /** Omitted where cancelling has nothing to close, as in the reply slot. Cancel then only clears
   *  local text, and disables itself when there is none, rather than sitting there doing nothing. */
  onCancel?: () => void;
  onDirtyChange: (dirty: boolean) => void;
};

// Keep unsaved text local until the author explicitly saves or cancels it.
export function ThreadEditor({ label, autoFocus = false, initialText = '', saveLabel, onSave, onCancel, onDirtyChange }: ThreadEditorProps) {
  const [text, setText] = useState(initialText);
  const inputId = useId();
  const dirtyCallback = useRef(onDirtyChange);

  // Keep cleanup connected to the latest parent without clearing a live draft.
  useEffect(() => { dirtyCallback.current = onDirtyChange; }, [onDirtyChange]);

  // Release the dirty guard when this particular editor leaves the screen.
  useEffect(() => {
    // A departed editor cannot keep navigation locked.
    return () => { dirtyCallback.current(false); };
  }, []);

  // Report changes immediately so another interaction cannot replace dirty text.
  function changeText(event: ChangeEvent<HTMLTextAreaElement>) {
    const nextText = event.target.value;
    setText(nextText);
    onDirtyChange(nextText !== initialText);
  }

  // Submit from the keyboard without leaving the textarea; requestSubmit reuses the form's own path.
  function maybeSubmit(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey) || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  // Reject blank submissions and hand trimmed content to the shared thread state.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = text.trim();
    if (!content) return;
    onDirtyChange(false);
    onSave(content);
    setText('');
  }

  // Discard only this editor's local changes through the explicit Cancel action.
  function cancel() {
    setText(initialText);
    onDirtyChange(false);
    onCancel?.();
  }

  return (
    <form className="thread-editor mt-[18px]" onSubmit={submit}>
      <label className="mb-2 block text-xs font-medium" htmlFor={inputId}>{label}</label>
      <textarea
        id={inputId}
        autoFocus={autoFocus}
        rows={4}
        value={text}
        onChange={changeText}
        onKeyDown={maybeSubmit}
        placeholder="Share a thought…"
        className="block max-h-[280px] min-h-[92px] w-full resize-y rounded-lg border border-[#d8d9ce] bg-surface px-3 py-[11px] leading-relaxed text-ink-soft placeholder:text-[#909186] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#577557]"
      />
      <div className="mt-2.5 flex flex-wrap items-center gap-[7px]">
        <span className="mb-1 basis-full text-2xs text-muted">Posting as Dalton</span>
        <button type="button" className={quietButton} title={text === initialText ? 'Nothing to discard' : 'Discard what you have typed'} disabled={!onCancel && text === initialText} onClick={cancel}>Cancel</button>
        <button type="submit" className={primaryButton} aria-keyshortcuts={submitShortcut} disabled={!text.trim()}>
          {saveLabel}
          <kbd aria-hidden="true" className="ml-1.5 text-2xs/none opacity-70">{submitHint}</kbd>
        </button>
      </div>
    </form>
  );
}
