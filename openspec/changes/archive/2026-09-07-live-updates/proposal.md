## Why

Everything the app shows is polled: the price every 5 s, the account every 5 s, the feed every 10 s, the candles every 15 s. That was the right call while the core was being built — it is honest, it degrades visibly ("couldn't refresh") and it never breaks. But it means the app is always a few seconds behind the market, and it shows exactly where it matters most: an idea that hits its take profit sits there saying "live · 2h left" for up to ten seconds before the badge appears, and the price on the Trade screen ticks in steps instead of moving.

The SDK already publishes what we need over WebSocket — `marketPrices.subscribeAll`, `userPositions.subscribeByAddr`, `accountOverview.subscribeByAddr`, each returning an unsubscribe function — but those subscriptions need the Geomi API key, so they belong on the server. The browser cannot open them.

**Tier served:** STRETCH "real-time updates via WebSocket subscriptions instead of polling" — the last one on the brief's list that is still not done.

## What Changes

- **A stream from the server**: `GET /api/stream` (Server-Sent Events) forwards what the SDK publishes. One upstream subscription set per server instance, fanned out to every connected viewer, opened when the first viewer arrives and closed when the last one leaves.
- **Prices arrive as data; everything else arrives as a nudge.** The stream carries live prices (small, frequent, useful everywhere) and, for the account, a "something changed" event that makes the browser refresh the data it already knows how to fetch. That avoids a second implementation of the account composition and the feed loader — the bug that duplication would cause is worse than the round trip it saves.
- **An idea settles the moment it crosses.** The browser already knows every idea's take-profit and stop-loss prices; when a live price crosses one, it refreshes the feed immediately, so the badge appears when it happens instead of on the next poll.
- **Polling never leaves.** `useLive` sits beside `usePoll`: while the stream is connected the polls slow down to a heartbeat; if the stream drops, closes or was never available, the polls return to their current intervals and the app behaves exactly as it does today. The interface says which mode it is in, in plain words.
- **The stream survives the platform's limits.** A serverless function cannot hold a connection forever, so the route closes its own stream before the platform does and the browser reconnects on its own; the user sees nothing.

## Capabilities

### Modified Capabilities

- `trading`: adds the stream route and makes the Trade screen's price and account live, with the polling fallback and the visible state.
- `copy-trade-signals`: the feed's prices and each card's "now" marker follow the stream, and an idea that crosses a level is settled and shown without waiting for the next poll.

## Non-goals

- No streaming of candles, order books or trades: the chart keeps its own fetch, and a live candle stream would multiply the payload for a chart nobody is staring at tick by tick.
- No removal of any poll, and no change to how an order is placed, priced or gated.
- No per-user streams: one testnet account signs everything, so every viewer sees the same account events. Real per-user streams belong with wallet-based signing.

## Impact

- New `lib/decibel/stream.ts` (the server-side hub over the SDK subscriptions), `app/api/stream/route.ts` (SSE), `hooks/useLive.ts`.
- `components/TradeScreen.tsx`, `components/MarketPanel.tsx`, `components/AccountCard.tsx`, `components/Feed.tsx`, `components/SignalCard.tsx` consume live prices and the refresh nudges; `hooks/usePoll.ts` accepts a slower interval while live.
- No new dependencies: SSE is a plain HTTP response and `EventSource` is built into the browser.
