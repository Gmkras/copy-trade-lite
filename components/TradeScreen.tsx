"use client";

import { AccountCard } from "@/components/AccountCard";
import { TradeForm } from "@/components/TradeForm";
import { usePoll } from "@/hooks/usePoll";
import type { AccountState, Market } from "@/lib/schemas";

const ACCOUNT_POLL_MS = 5000;

/** Owns the account poll so the form can refresh it right after an order. */
export function TradeScreen({ markets }: { markets: Market[] }) {
  const account = usePoll<AccountState>("/api/account", ACCOUNT_POLL_MS);
  return (
    <div className="flex flex-col gap-6">
      <TradeForm markets={markets} onOrderPlaced={account.refresh} />
      <AccountCard state={account.data} stale={account.stale} loading={account.loading} error={account.error} />
    </div>
  );
}
