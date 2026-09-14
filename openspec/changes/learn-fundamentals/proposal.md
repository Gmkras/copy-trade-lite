## Why

Three questions come up in almost every engineering interview — what the stack and the heap are, what a stack overflow is and why it happens, and how TCP differs from UDP. This app is an unusually good place to answer them, because it already contains all three: `placeMarketOrder` pushes seven frames while a 240-candle array lives on the heap; a copy-trade platform must prevent a copy from copying itself; and the app deliberately uses TCP for orders and would want UDP semantics for prices — which is exactly why `useLive` keeps only the newest mid and drops the rest.

This serves **no tier of the brief**. It is separate material that happens to be explained best with this codebase, so it is reachable only by URL and adds nothing to the product's navigation.

## What Changes

- A new page at `/learn`, in English, with three sections — Stack & Heap, Stack Overflow, TCP vs UDP — each opening with one sentence worth remembering, then an interactive the reader operates before reading anything, then the same idea in TypeScript and in Rust side by side, then how it already appears in this app.
- **Three interactives**: a memory visualiser that pushes and pops frames while a `Vec`/array allocates on the heap; a recursion-depth slider that fills a stack until it produces each language's real error message, with a Recursive/Iterative toggle and a copy-loop variant; and a packet race that sends ten price updates down a TCP lane and a UDP lane with a packet-loss slider, so head-of-line blocking is visible.
- A six-question quiz with immediate feedback.
- The simulations' arithmetic lives in `lib/learn/` as pure functions with unit tests, like every other calculation in this project.
- **No navigation entry.** The bar keeps exactly its two tabs, and on `/learn` neither is highlighted.
- **Rust appears only as quoted text inside JSX** — comparison snippets the reader looks at. No `.rs` file, no Rust toolchain, no new dependency: the project stays 100% TypeScript.

## Capabilities

### New Capabilities
- `learn`: a self-contained explainer page for three computer-science questions, taught through this application's own code.

### Modified Capabilities

None. The two-tab navigation requirement in `app-shell` already says the bar carries exactly two tabs on every screen, which `/learn` satisfies by not being one of them.

## Non-goals

No navigation entry, no link from the feed or the trade screen, no more questions than these three, no new dependency, no Rust that is compiled or run, and no change to any existing screen, route or spec.

## Impact

New: `app/learn/page.tsx`, five components under `components/learn/`, and `lib/learn/simulate.ts` with its tests. Nothing existing is modified.
