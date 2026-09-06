"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

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
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (message: string, options: ShowOptions = {}) => {
      const id = nextId.current++;
      const toast: Toast = { id, message, variant: options.variant ?? "info", link: options.link };
      setToasts((current) => [...current, toast]);
      timers.current.set(
        id,
        window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS),
      );
    },
    [dismiss],
  );

  // Clear pending auto-dismiss timers if the provider ever unmounts.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => window.clearTimeout(timer));
      pending.clear();
    };
  }, []);

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
              "pointer-events-auto w-full max-w-lg rounded-card border bg-surface px-4 py-3 text-base text-text",
              toast.variant === "success" && "border-up/40",
              toast.variant === "error" && "border-down/40",
              toast.variant === "info" && "border-line",
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
