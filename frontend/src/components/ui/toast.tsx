import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { cn } from "../../lib/utils";

export type ToastMessage = {
  message: string;
  type: "error" | "success";
};

type AppToastProps = {
  toast: ToastMessage;
  onClose: () => void;
  className?: string;
  durationMs?: number;
};

export function AppToast({ toast, onClose, className, durationMs = 3000 }: AppToastProps) {
  const timeoutRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const remainingMsRef = useRef<number>(durationMs);
  const [isPaused, setIsPaused] = useState(false);
  const toastKey = `${toast.type}:${toast.message}`;

  function clearCloseTimer() {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  function scheduleClose(nextRemainingMs: number) {
    clearCloseTimer();
    if (nextRemainingMs <= 0) {
      onClose();
      return;
    }
    startedAtRef.current = Date.now();
    remainingMsRef.current = nextRemainingMs;
    timeoutRef.current = window.setTimeout(() => {
      onClose();
    }, nextRemainingMs);
  }

  useEffect(() => {
    remainingMsRef.current = durationMs;
    setIsPaused(false);
    scheduleClose(durationMs);
    return () => clearCloseTimer();
  }, [toastKey, durationMs]);

  function handleMouseEnter() {
    if (isPaused) return;
    const elapsedMs = Date.now() - startedAtRef.current;
    remainingMsRef.current = Math.max(0, remainingMsRef.current - elapsedMs);
    clearCloseTimer();
    setIsPaused(true);
  }

  function handleMouseLeave() {
    if (!isPaused) return;
    setIsPaused(false);
    scheduleClose(remainingMsRef.current);
  }

  const toastNode = (
    <div
      className={cn("toast", toast.type === "success" ? "toast-success" : "toast-error", isPaused ? "toast-paused" : "", className)}
      role="status"
      aria-live="polite"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span className={cn("toast-icon-wrap", toast.type === "success" ? "toast-icon-success" : "toast-icon-error")}>
        {toast.type === "success" ? <CheckCircle2 className="toast-icon" /> : <AlertTriangle className="toast-icon" />}
      </span>
      <p className="toast-message">{toast.message}</p>
      <button type="button" className="toast-close-btn" onClick={onClose} aria-label="Close notification">
        <X className="h-4 w-4" />
      </button>
      <span key={toastKey} className="toast-progress" style={{ animationDuration: `${durationMs}ms` }} />
    </div>
  );

  if (typeof document === "undefined") return toastNode;
  return createPortal(toastNode, document.body);
}
