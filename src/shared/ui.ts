// Control shapes shared by the panel, the editor and the dialog, so every button agrees on
// size, disabled treatment and focus ring. Kept as strings rather than components: these are
// styling only, and the elements they land on differ in role, semantics and attributes.
export const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#577557]';
export const baseButton = `cursor-pointer transition-colors disabled:cursor-default disabled:opacity-45 max-stack:min-h-11 max-stack:min-w-11 ${focusRing}`;
export const chipButton = `${baseButton} min-h-[31px] rounded-md border border-[#dcded2] px-2.5 py-1.5 text-xs`;
export const quietButton = `${chipButton} bg-transparent text-[#616654] hover:bg-[#f0f1e9]`;
export const primaryButton = `${chipButton} border-forest bg-forest text-white hover:not-disabled:bg-forest-deep`;
export const linkButton = `${baseButton} border-0 bg-transparent py-[3px] text-xs text-[#6b725f] hover:underline`;
export const statusLabel = 'text-2xs font-semibold tracking-widest uppercase';

// Enter alone must still insert a newline, so submitting from the keyboard needs a modifier.
// Apple platforms show the command glyph; everywhere else the control key is spelled out.
const isApple = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.userAgent);
export const submitHint = isApple ? '\u2318\u21A9' : 'Ctrl+\u21A9';
export const submitShortcut = isApple ? 'Meta+Enter' : 'Control+Enter';
