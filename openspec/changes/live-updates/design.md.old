## Context

Four polls drive the app today, all through `hooks/usePoll.ts`: price and account every 5 s (`TradeScreen`), the feed every 10 s (`Feed`, `FeedRail`), candles every 15 s (`MarketPanel`) and the signal detail every 10 s. `usePoll` already keeps the last good data on failure (`stale`), pauses on a `null` url and exposes `refresh()`. `GET /api/account` composes equity, positions, orders and fills by joining market addresses to names; `loadFeed()` reads the database, settles outcomes from candles and fetches prices and candles per market. The SDK's readers expose `subscribeAll(onData)` on market prices and `subscribeByAddr(subAddr, onData)` on positions, account overview, open orders and trade history, each returning an unsubscribe function; all of them need the Geomi key, so they only work server-side. Vercel limits how long one request may run. See proposal.md for why.

## Goals / Non-Goals

**Goals:**
- Live where it is felt: the price, the account after an order, and an idea's result the moment it crosses.
- One implementation of the data: the stream must not become a second, divergent way to build the account or the feed.
- A fallback that is not a promise but the current code path, untouched.

**Non-Goals:**
- Streaming candles, depth or trades; per-user streams; removing any poll.

## Decisions

### D1. Server-Sent Events, not a WebSocket to the browser
The upstream data arrives over WebSocket **on the server**, because the subscription needs the API key. What remains is server → browser, one direction, small messages. SSE is exactly that shape: a plain HTTP response, `EventSource` built into every browser, automatic reconnection with a server-controlled delay, and it passes proxies that block WebSocket upgrades. A browser WebSocket would need a second protocol, a heartbeat and reconnection logic written by hand, for a channel that never sends anything upward. Alternative: long polling — rejected, it is SSE with worse ergonomics.

### D2. Prices are data; the account is a nudge
The stream sends two kinds of event:

- `price`: `{ market, mid, mark }` per update. Small, frequent, and directly useful in the hero, the card sentence and the "now" marker.
- `account`: **empty payload**. It means "something changed, ask again", and the browser calls the `/api/account` it already knows how to call.

Rebuilding the account from WS messages would duplicate the address→name join, the PnL maths and the empty-account rule that `lib/decibel/account.ts` owns — a second implementation that would drift. The nudge costs one round trip and keeps one source of truth. It also has a security dividend: the stream carries no balances, no positions and no addresses, so a channel that anyone can open exposes nothing (the read routes already decide what is public).

### D3. One hub per server instance, reference-counted
`lib/decibel/stream.ts` holds a module-level hub: a `Set` of listeners plus the unsubscribe functions. The first listener opens `marketPrices.subscribeAll`, `userPositions.subscribeByAddr`, `accountOverview.subscribeByAddr`, `userOpenOrders.subscribeByAddr` and `userTradeHistory.subscribeByAddr`; the last one to leave calls every unsubscribe and clears the hub. Three viewers on one instance share one set of upstream subscriptions. Different serverless instances each keep their own — acceptable, and the alternative (an external broker) is far beyond this project.

Account events are **coalesced**: several upstream messages within 250 ms produce one `account` event, so a fill that touches positions, orders and history does not trigger three refreshes.

### D4. The route ends the stream before the platform does
A serverless function cannot hold a request open indefinitely. `app/api/stream/route.ts` runs on the Node runtime with `maxDuration` set, writes `retry: 3000` once at the start, and closes the stream itself at a window comfortably below the limit, after sending a `bye` event. `EventSource` reconnects on its own, so the viewer sees a continuous stream. A comment records the two numbers and why they differ. A `ping` comment line every 15 s keeps intermediaries from closing an idle connection.

### D5. The browser asks; it never decides
`Feed` knows each idea's `tpPrice`/`slPrice` and now receives live prices. When a streamed price crosses a level of an **open** idea, it calls `feed.refresh()` — and the server settles the outcome from candles as it already does. The browser never writes an outcome or renders one it invented: it only shortens the wait. This keeps `settleSignal` the single judge (what is shown and what is stored cannot disagree) and it is the reason the spec scenario "The browser never invents the outcome" exists. A refresh is triggered at most once every 3 s per idea, so a price oscillating around a level cannot cause a storm.

### D6. `useLive` beside `usePoll`, and the polls stay
`hooks/useLive.ts` opens the `EventSource`, exposes `{ live, prices, accountVersion, signalsVersion }` and closes it on unmount. `live` is false until the first event arrives and returns to false on `error`. Consumers keep their `usePoll` exactly as it is, with one change: the interval becomes `live ? SLOW : NORMAL` (30 s vs 5–10 s), so the poll turns into a heartbeat that also repairs anything the stream missed, and returns to its normal rhythm the instant the stream drops. Nothing is deleted, so "the fallback" is not new code that has never run — it is the code that runs today.

The screens say which mode they are in, in plain words: "live" or "refreshing every 5s", next to where the "couldn't refresh" chip already appears. No new colour, no icon that needs explaining.

## Risks / Trade-offs

- [The platform kills the request anyway] → the route closes first and the browser reconnects; if reconnection also fails, `live` goes false and the polls carry the app. Verified by blocking the route in the browser.
- [Many viewers, one upstream set per instance] → reference counting keeps it to one; the demo has one or two viewers, and the failure mode of more is extra upstream connections, not wrong data.
- [Price events arrive faster than React can render] → the hook keeps the latest price per market in a ref and flushes on an animation frame, so a burst is one render.
- [A stream that silently stops sending] → the heartbeat poll still runs at 30 s, so the screen cannot freeze; the worst case degrades to today's behaviour.
- [More load on the exchange] → fewer requests than today, not more: five subscriptions replace four polls per viewer, and the polls slow to 30 s while connected.

## Migration Plan

No data or environment changes. The stream is additive: with `/api/stream` unreachable the app behaves exactly as it does now. Rollback is reverting the commit.

## Open Questions

None.
