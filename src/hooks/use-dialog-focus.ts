"use client";
import { useEffect, useRef } from "react";

const registryKey = Symbol.for("navelix.dialog-focus");
interface DialogEntry { panel: HTMLElement; priority: number }
type DialogDocument = Document & { [registryKey]?: DialogEntry[] };
const selector = 'button:not(:disabled), a[href], input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]';

/** Only the top dialog handles keys; restore focus to its opener on close. */
export function useDialogFocus(open: boolean, onClose: () => void, priority = 50) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;
    const previous = document.activeElement;
    const doc = document as DialogDocument;
    const dialogs = doc[registryKey] ??= [];
    const entry = { panel, priority };
    dialogs.push(entry);
    const top = () => dialogs.filter(entry => entry.panel.isConnected).sort((a, b) => a.priority - b.priority).at(-1)?.panel === panel;
    if (top()) panel.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (!top()) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeRef.current(); return; }
      if (event.key !== "Tab") return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(selector)).filter(item => !item.closest('[hidden], [aria-hidden="true"]') && getComputedStyle(item).display !== "none" && getComputedStyle(item).visibility !== "hidden");
      const first = items[0]; const last = items.at(-1);
      if (!first || !last) { event.preventDefault(); panel.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel)) { event.preventDefault(); first.focus(); }
    };
    const onFocus = (event: FocusEvent) => {
      if (top() && event.target instanceof Node && !panel.contains(event.target)) panel.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocus);
    return () => {
      // React may remove the panel from the DOM before passive effect cleanup.
      const wasTop = dialogs.filter(item => item === entry || item.panel.isConnected).sort((a, b) => a.priority - b.priority).at(-1) === entry;
      dialogs.splice(dialogs.indexOf(entry), 1);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocus);
      if (wasTop && previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [open, priority]);
  return panelRef;
}
