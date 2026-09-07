"use client";

import { useCallback, useRef, useState } from "react";

import { ApiError } from "@/hooks/usePoll";

/**
 * Client half of the demo gate.
 *
 * Writes carry the code stored in this browser. When the server refuses one,
 * `run` asks the user for the code, keeps it for next time and retries the same
 * action. A local clone never sees the prompt, because its server never answers
 * with `DEMO_CODE_REQUIRED`.
 *
 * The value only ever lives in `localStorage` and in the header: it is never
 * rendered back, logged, or put in a URL.
 */

const STORAGE_KEY = "copy-trade.demo-passcode";
const WRONG_CODE = "That code wasn't accepted. Check it and try it again.";

/** localStorage throws in some privacy modes, so every access is guarded. */
function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(value: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Not being able to remember it only means asking again next time.
  }
}

function clearStored(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do: the stored value is a convenience, not state we rely on.
  }
}

function isPasscodeError(error: unknown): boolean {
  return error instanceof ApiError && error.code === "DEMO_CODE_REQUIRED";
}

export type PasscodePrompt = {
  open: boolean;
  /** Shown above the input after a rejected attempt. */
  error: string | null;
  onSubmit: (code: string) => void;
  onCancel: () => void;
};

export function useDemoPasscode() {
  const [prompt, setPrompt] = useState<{ open: boolean; error: string | null }>({ open: false, error: null });
  const resolver = useRef<((code: string | null) => void) | null>(null);

  const ask = useCallback(
    (error: string | null) =>
      new Promise<string | null>((resolve) => {
        resolver.current = resolve;
        setPrompt({ open: true, error });
      }),
    [],
  );

  const settle = useCallback((code: string | null) => {
    const resolve = resolver.current;
    resolver.current = null;
    setPrompt({ open: false, error: null });
    resolve?.(code);
  }, []);

  /**
   * Runs a write, handling the demo code around it. `action` receives the code
   * to send (null when there is none) and is retried after the user enters one.
   * Any other failure is rethrown untouched for the caller's toast.
   */
  const run = useCallback(
    async <T,>(action: (passcode: string | null) => Promise<T>): Promise<T> => {
      let passcode = readStored();
      let message: string | null = null;
      for (;;) {
        try {
          return await action(passcode);
        } catch (error) {
          if (!isPasscodeError(error)) throw error;
          clearStored();
          const entered = await ask(message);
          if (entered === null) throw error; // the user closed the prompt
          passcode = entered;
          writeStored(entered);
          message = WRONG_CODE;
        }
      }
    },
    [ask],
  );

  return {
    run,
    prompt: {
      open: prompt.open,
      error: prompt.error,
      onSubmit: (code: string) => settle(code),
      onCancel: () => settle(null),
    } satisfies PasscodePrompt,
  };
}
