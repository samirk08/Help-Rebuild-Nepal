"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type ToastContextValue = { showToast: (message: string) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

const VISIBLE_MS = 6000;
/** Must match the exit transition on `.toast` in globals.css. */
const EXIT_MS = 240;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState("");
  const [closing, setClosing] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const unmountTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clearTimers = () => {
    clearTimeout(hideTimer.current);
    clearTimeout(unmountTimer.current);
  };

  /**
   * Play the exit transition, then unmount. The node has to stay in the tree
   * while it animates out — React removing it immediately is exactly what made
   * the old toast vanish rather than leave.
   */
  const dismiss = useCallback(() => {
    clearTimers();
    setClosing(true);
    unmountTimer.current = setTimeout(() => {
      setMessage("");
      setClosing(false);
    }, EXIT_MS);
  }, []);

  const showToast = useCallback(
    (next: string) => {
      clearTimers();
      setClosing(false);
      setMessage(next);
      hideTimer.current = setTimeout(dismiss, VISIBLE_MS);
    },
    [dismiss]
  );

  useEffect(() => clearTimers, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {message ? (
          <div className="toast" data-closing={closing}>
            <span className="toast__dot" aria-hidden="true" />
            <span className="toast__msg">{message}</span>
            <button
              type="button"
              className="reset-button toast__close"
              onClick={dismiss}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
