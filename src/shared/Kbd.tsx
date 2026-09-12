// Shortcut badge. Always aria-hidden: the owning control carries aria-keyshortcuts, and a bare
// glyph read aloud between words is noise rather than information.
export function Kbd({ children }: { children: string }) {
  return <kbd aria-hidden="true" className="mx-0.5 rounded border border-[#d4d9c9] bg-[#fbfcf6] px-[5px] py-[3px] text-2xs/none text-muted">{children}</kbd>;
}
