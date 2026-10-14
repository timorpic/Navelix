"use client";
import { useDialogFocus } from "@/hooks/use-dialog-focus";

/** Custom dialog layouts share focus, Escape and restoration behavior with Modal. */
interface OverlayProps {
  children: React.ReactNode;
  title: string;
  onClose: () => void;
}
export default function Overlay({ children, title, onClose }: OverlayProps) {
  const ref = useDialogFocus(true, onClose);
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      {children}
    </div>
  );
}
