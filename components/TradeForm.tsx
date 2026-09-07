"use client";

import { useMemo, useRef, useState } from "react";

import { BigButton } from "@/components/BigButton";
import { PasscodeSheet } from "@/components/PasscodeSheet";
import { SideToggle } from "@/components/SideToggle";
import { SizePicker, sizeChips } from "@/components/SizePicker";
import { useToast } from "@/components/Toast";
import { useDemoPasscode } from "@/hooks/useDemoPasscode";
import { postEnvelope } from "@/hooks/usePoll";
import { amount, money } from "@/lib/format";
import type { Market, OrderReceipt, OrderSide } from "@/lib/schemas";

type TradeFormProps = {
  market: Market;
  /** Live mid from the price poll TradeScreen owns; null until it arrives. */
  mid: number | null;
  /** Called after a successful order so the account card can refresh immediately. */
  onOrderPlaced?: () => void;
};

/**
 * The order ticket: direction, how much, and the one yellow button. The coin
 * pills and the chart are siblings owned by TradeScreen, so a wide screen can
 * lay them out as a trading terminal without changing this component.
 */
export function TradeForm({ market, mid, onOrderPlaced }: TradeFormProps) {
  const { show } = useToast();
  const { run, prompt } = useDemoPasscode();
  const [side, setSide] = useState<OrderSide>("up");
  const [sizeText, setSizeText] = useState(() => amount(sizeChips(market)[0] ?? market.minSize));
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  // The size chips belong to the selected coin: reset them when it changes.
  const [chipsFor, setChipsFor] = useState(market.name);
  if (chipsFor !== market.name) {
    setChipsFor(market.name);
    setSizeText(amount(sizeChips(market)[0] ?? market.minSize));
  }

  const size = Number(sizeText);
  const sizeValid = useMemo(
    () => Number.isFinite(size) && size >= market.minSize && size <= market.maxOrderSize,
    [market, size],
  );

  const canSubmit = sizeValid && mid !== null && !pending;
  const verb = side === "up" ? "Buy" : "Sell";
  const label =
    sizeValid && mid !== null
      ? `${verb} ${amount(size)} ${market.symbol} ≈ $${money(size * mid)}`
      : !sizeValid
        ? "Choose a valid amount"
        : "Waiting for price…";

  async function submit() {
    if (!canSubmit || inFlight.current) return; // ref guard: a double tap never sends twice
    inFlight.current = true;
    setPending(true);
    try {
      const receipt = await run((passcode) => fetchOrder({ market: market.name, side, size }, passcode));
      show(`Order sent: ${verb.toLowerCase()} ${amount(receipt.size)} ${market.symbol} at about $${money(receipt.referencePrice)}`, {
        variant: "success",
        link: { href: receipt.explorerUrl, label: "See it on the explorer" },
      });
      onOrderPlaced?.();
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
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <SideToggle value={side} onChange={setSide} />

        <SizePicker market={market} value={sizeText} onChange={setSizeText} valid={sizeValid} />

        <BigButton type="submit" disabled={!canSubmit} pending={pending} pendingLabel="Sending your order…">
          {label}
        </BigButton>
        <p className="text-center text-sm text-muted">Play money on Aptos testnet. Nothing here is real.</p>
      </form>
      <PasscodeSheet {...prompt} />
    </>
  );
}

function fetchOrder(body: { market: string; side: OrderSide; size: number }, passcode: string | null): Promise<OrderReceipt> {
  return postEnvelope<OrderReceipt>("/api/order", body, passcode);
}
