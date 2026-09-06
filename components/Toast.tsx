"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type ToastVariant = "info" | "success" | "error";

type Toast = {
  id: number;
  message: string;
  variant: ToastVariant;
  link?: { href: string; label: string };
};

type ShowOptions = {
  variant?: ToastVariant;
  link?: Toast["link"];
};

type ToastContextValue = {
  show: (message: string, options?: ShowOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 4000;

/** Wraps the app once (in the root layout). Toasts stack above the bottom nav. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (message: string, options: ShowOptions = {}) => {
      const id = nextId.current++;
      const toast: Toast = { id, message, variant: options.variant ?? "info", link: options.link };
      setToasts((current) => [...current, toast]);
      window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={[
              "pointer-events-auto w-full max-w-lg rounded-card border px-4 py-3 text-base shadow-none",
              toast.variant === "success" && "border-up/40 bg-surface text-text",
              toast.variant === "error" && "border-down/40 bg-surface text-text",
              toast.variant === "info" && "border-line bg-surface text-text",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <p>{toast.message}</p>
            {toast.link ? (
              <a
                href={toast.link.href}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-yellow underline underline-offset-4"
              >
                {toast.link.label}
              </a>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Access from any client component: `const { show } = useToast(); show("Saved!", { variant: "success" })`. */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside <ToastProvider> (see app/layout.tsx)");
  }
  return context;
}
