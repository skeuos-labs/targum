import { useEffect } from 'react';
import { useUiStore } from '../state/uiStore';

const TOAST_DISMISS_MS = 2000;

/** Non-blocking status pill. Reads uiStore.toast; auto-dismisses after 2s. */
export function Toast() {
  const toast = useUiStore((s) => s.toast);
  const clearToast = useUiStore((s) => s.clearToast);
  const toastId = toast?.id;

  useEffect(() => {
    if (toastId === undefined) {
      return;
    }
    const timer = setTimeout(() => clearToast(toastId), TOAST_DISMISS_MS);
    return () => {
      clearTimeout(timer);
      // clearToast(id) only clears when the id still matches — safe on
      // toast swap, re-render, and unmount.
      clearToast(toastId);
    };
  }, [toastId, clearToast]);

  if (!toast) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-foreground shadow-lg"
    >
      {toast.message}
    </div>
  );
}
