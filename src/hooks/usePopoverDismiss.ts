// Closes a popover on an outside click or the Escape key.
import { useEffect, type RefObject } from "react";

// Shared by every trigger+portalled-popover control in this app
// (ModelSelector, HistoryModelFilter) -- closes the popover on an outside
// click or Escape, while a click on the trigger itself (which already
// toggles it) or inside the popover panel is left alone.
export function usePopoverDismiss(
  open: boolean,
  onDismiss: () => void,
  triggerRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedTrigger = triggerRef.current?.contains(target);
      const clickedPanel = panelRef.current?.contains(target);
      if (!clickedTrigger && !clickedPanel) onDismiss();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onDismiss, triggerRef, panelRef]);
}
