"use client";

import { useRef, useState } from "react";

import { BigButton } from "@/components/BigButton";
import { PasscodeSheet } from "@/components/PasscodeSheet";
import { useToast } from "@/components/Toast";
import { useDemoPasscode } from "@/hooks/useDemoPasscode";
import { postEnvelope } from "@/hooks/usePoll";
import { amount, money } from "@/lib/format";
import type { CopyReceipt, SignalView } from "@/lib/schemas";

type CopyPanelProps = {
  signal: SignalView;
  /** Display name attached to the copy (play name; same testnet key). */
  copierName?: string;
  onCopied: (receipt: CopyReceipt) => void;
};

/** The one action on the detail screen: copy this trade into your own account. */
export function CopyPanel({ signal, copierName = "You", onCopied }: CopyPanelProps) {
  const { show } = useToast();
  const { run, prompt } = useDemoPasscode();
  const [copier, setCopier] = useState(copierName);
  const [size, setSize] = useState(amount(signal.size));
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

  const sizeNumber = Number(size);
  const sizeValid = Number.isFinite(sizeNumber) && sizeNumber > 0;
  const canSubmit = !signal.expired && sizeValid && copier.trim().length > 0 && !pending;

  async function submit() {
    if (!canSubmit || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    try {
      const receipt = await run((passcode) =>
        postEnvelope<CopyReceipt>(`/api/signals/${signal.id}/copy`, { copier: copier.trim(), size }, passcode),
      );
      show(
        `Copied: ${receipt.side === "up" ? "bought" : "sold"} ${amount(receipt.size)} ${signal.symbol} at about $${money(receipt.referencePrice)}` +
          (receipt.tpSlAttached ? "" : " (the exchange did not accept the exit levels, so only the entry was placed)"),
        { variant: "success", link: { href: receipt.explorerUrl, label: "See it on the explorer" } },
      );
      onCopied(receipt);
    } catch (error) {
      show(error instanceof Error ? error.message : "Something went wrong. Try again.", { variant: "error" });
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">Your name</span>
            <input
              value={copier}
              onChange={(e) => setCopier(e.target.value)}
              maxLength={40}
              disabled={signal.expired}
              className="min-h-12 rounded-card border border-line bg-surface px-4 text-text disabled:opacity-60"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">How much ({signal.symbol})</span>
            <input
              inputMode="decimal"
              autoComplete="off"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              disabled={signal.expired}
              aria-invalid={!sizeValid}
              className={["min-h-12 rounded-card border bg-surface px-4 font-display text-lg text-text disabled:opacity-60", sizeValid ? "border-line" : "border-down"].join(" ")}
            />
          </label>
        </div>
        <BigButton type="submit" disabled={!canSubmit} pending={pending} pendingLabel="Copying…">
          {signal.expired ? "This idea has expired" : "Copy this trade"}
        </BigButton>
        <p className="text-center text-sm text-muted">
          {signal.expired
            ? "Expired ideas can't be copied. Pick a live one from the feed."
            : "Same trade, from your own testnet account, with the author's exit levels attached."}
        </p>
      </form>
      <PasscodeSheet {...prompt} />
    </>
  );
}
