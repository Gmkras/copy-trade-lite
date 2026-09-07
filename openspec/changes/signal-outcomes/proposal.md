## Why

The feed persists every idea and every copy, but nothing ever says whether an idea **worked**. A card reads "copied 2× · live · 23h left" and, once the hold ends, "expired" — the same word whether the price hit the take profit on the first minute or collapsed through the stop loss. So the "track record" the brief asks for (SHOULD 8) is today a list of posts, not a record: a visitor cannot tell a good author from a loud one, which is the whole reason to copy someone.

The database was built for this: the `signals` table already has an `outcome` column with `CHECK (outcome IN ('tp','sl','expired'))`, written as `NULL` on insert and never updated. This change fills it in.

**Tier served:** STRETCH "mark signal outcome (hit TP / hit SL / expired) by reading back fills/positions" — done from candles, which is more honest for an idea nobody copied — and it completes SHOULD 8.

## What Changes

- **Ideas are settled from the price history.** For every idea whose outcome is still unknown, the app reads the market's candles since it was posted and decides: **hit take profit** when the price reached the take-profit level, **hit stop loss** when it reached the stop, **expired** when the hold ended without either. A settled idea is written to the database once and never recomputed.
- **One candle read per market, not per idea.** Unsettled ideas are grouped by market, one series is fetched covering the oldest of them, and every idea of that market is judged against it. A market that cannot be read leaves its ideas unsettled for now; nothing fails.
- **The result is visible wherever the idea is.** A badge on the card and on the detail: "hit take profit ✅" in the up colour, "hit stop loss ❌" in the down colour, "expired ⏱" in grey. A settled card stops offering a copy and says how it went.
- **Authors get a hit rate.** The per-author summary gains settled/won counts, so the feed can show "3 ideas · 2 copies · 2 of 3 hit" instead of only volume.
- **Honesty about precision.** Settlement uses candle highs and lows, not fills. When a single candle crossed **both** levels, the app cannot know which came first and records the **stop loss**, the conservative reading; the README says so.

## Capabilities

### Modified Capabilities

- `copy-trade-signals`: adds the settlement requirement (how an outcome is decided, persisted and displayed), and the listing requirement now returns the outcome and the per-author hit rate.

## Non-goals

- No reading of fills or positions to settle: an idea nobody copied has no fills, and the same rule must apply to every idea.
- No leaderboard page and no third navigation tab; the hit rate stays inside the existing author summary.
- No re-settlement: once an idea is marked, it stays marked, even if the price later crosses the other level.
- No change to how an order is placed, priced or gated.

## Impact

- New `lib/signals/outcome.ts` (pure decision function + the grouping/fetch pass), `lib/decibel/markets.ts` (a candle window "since a timestamp"), `lib/signals/repo.ts` (`setOutcome`, hit-rate columns in `authorStats`), `lib/signals/feed.ts` (run the pass), `lib/schemas.ts` (`AuthorStats` gains `settled` and `won`).
- `components/SignalCard.tsx`, `components/SignalDetail.tsx`, `components/CopyPanel.tsx` (a settled idea is not copyable).
- No new dependencies. No schema migration: the `outcome` column already exists.
