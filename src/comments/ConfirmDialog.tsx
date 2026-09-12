import { useId, useLayoutEffect, useRef, type SyntheticEvent } from 'react';
import { chipButton, primaryButton } from '../shared/ui';

type ConfirmDialogProps = {
  title: string;
  description: string;
  /** The safe way out, and the default: it takes focus so Enter never destroys anything. */
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * The one confirmation in the app. Native modality traps focus for free, and every question that
 * risks losing work asks it the same way: same shape, same default, same focus behaviour.
 */
export function ConfirmDialog({ title, description, cancelLabel, confirmLabel, onCancel, onConfirm }: ConfirmDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(true);
  const id = useId();

  // Return focus to whatever opened this, unless confirming unmounts that control: then the parent's
  // own close flow owns focus, and restoring it here would fight for it.
  useLayoutEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    element?.showModal();
    cancelButton.current?.focus();
    return () => {
      element?.close();
      if (restoreFocus.current && previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, []);

  // Escape means cancel; prevent the browser closing the dialog outside React's state transition.
  function cancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    onCancel();
  }

  function confirm() {
    restoreFocus.current = false;
    onConfirm();
  }

  return (
    <dialog
      ref={dialog}
      className="m-auto w-[min(390px,calc(100vw-36px))] rounded-2xl border border-[#d8ddcf] bg-surface p-[26px] text-ink-soft shadow-[0_20px_70px_#263c3029] backdrop:bg-[#23332955]"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      onCancel={cancel}
    >
      <h2 id={`${id}-title`} className="mt-0 mb-3 text-xl font-semibold tracking-[-.4px]">{title}</h2>
      <p id={`${id}-description`} className="m-0 text-sm/loose text-[#6c7263]">{description}</p>
      <div className="mt-6 flex flex-wrap gap-2.5">
        <button ref={cancelButton} type="button" className={`${primaryButton} min-h-[38px] px-[13px] py-[9px]`} onClick={onCancel}>{cancelLabel}</button>
        <button type="button" className={`${chipButton} min-h-[38px] border-[#e1d6c9] bg-transparent px-[13px] py-[9px] text-clay hover:bg-[#f5ede4]`} onClick={confirm}>{confirmLabel}</button>
      </div>
    </dialog>
  );
}
