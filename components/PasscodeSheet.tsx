"use client";

import { useState } from "react";

import { BigButton } from "@/components/BigButton";
import { Sheet } from "@/components/Sheet";
import type { PasscodePrompt } from "@/hooks/useDemoPasscode";

/**
 * Asks for the demo code the deployed app needs before it will trade. It is
 * shown only when the server refuses a write, so a local clone never sees it.
 * The typed value goes straight to the request header; nothing displays it
 * afterwards.
 */
export function PasscodeSheet({ open, error, onSubmit, onCancel }: PasscodePrompt) {
  const [code, setCode] = useState("");

  // The field is emptied on the way out, so a rejected code is never left in it.
  function close() {
    setCode("");
    onCancel();
  }

  return (
    <Sheet open={open} onClose={close} title="Enter the demo code">
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const entered = code.trim();
          if (entered.length === 0) return;
          setCode("");
          onSubmit(entered);
        }}
      >
        <p className="text-sm text-muted">
          Browsing is open to everyone, but placing trades needs the code that came with this link. It&apos;s all play money on
          testnet — the code just keeps strangers from spending the demo balance.
        </p>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">Demo code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={error !== null}
            aria-describedby={error ? "passcode-error" : undefined}
            className={[
              "min-h-12 rounded-card border bg-surface px-4 font-display text-lg text-text",
              error ? "border-down" : "border-line",
            ].join(" ")}
          />
        </label>
        {error ? (
          <p id="passcode-error" role="alert" className="text-sm text-down">
            {error}
          </p>
        ) : null}
        <BigButton type="submit" disabled={code.trim().length === 0}>
          Continue
        </BigButton>
      </form>
    </Sheet>
  );
}
