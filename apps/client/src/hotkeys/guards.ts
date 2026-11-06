// When a key press must not trigger a shortcut (specs/keyboard-shortcuts "Key handling guards").

/** True when the event target takes typed text. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/** True while a modal dialog is open (Radix dialogs set role=dialog + data-state=open). */
export function modalOpen(doc: Document = document): boolean {
  return doc.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"]') !== null;
}

/** True when a shortcut is not allowed for this key event. */
export function ignoreKey(e: KeyboardEvent): boolean {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return true;
  if (e.defaultPrevented || e.isComposing) return true;
  if (isTypingTarget(e.target)) return true;
  // Enter and Space activate a focused button or link natively; do not fire twice.
  if ((e.key === "Enter" || e.key === " ") && e.target instanceof HTMLElement) {
    const tag = e.target.tagName;
    if (tag === "BUTTON" || tag === "A" || e.target.getAttribute("role") === "button") return true;
  }
  return false;
}
