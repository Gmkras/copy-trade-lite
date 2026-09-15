## Context

See `proposal.md` — Why. What shapes the approach:

- **This page has no server-side needs.** It reads no market data, no account, no database. It is the first screen in the project that is pure content plus client interaction, so it touches none of the server-only modules and needs no route.
- **The navigation already handles it.** `AppNav` computes `active` as `tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href)`. On `/learn` both are false, so neither tab highlights — the behaviour the spec asks for, with no change to `AppNav` and no change to the `app-shell` requirement, which asks for exactly two tabs on every screen rather than a tab per screen.
- **Nothing here is server-only.** No module under `lib/decibel/` or `lib/signals/` is imported, so the `server-only` boundary is untouched. The page is a Server Component that renders static content; the interactives are Client Components.
- **Zod schemas involved: none.** This change adds no route, no request body and no environment variable, so no schema is added and none is enforced anywhere new. That is worth stating rather than leaving implied, because every other change in this project added at least one.
- **The layout reserves room for the nav already** (`pb-16 lg:pb-0 lg:pt-16` on `body`), so the page does not manage that itself.

## Goals / Non-Goals

**Goals:**
- Three answers a reader still has a week later, because they operated something rather than read a paragraph.
- Every claim grounded in this repository's own code, quoted from it.
- The arithmetic behind each simulation testable without a browser.

**Non-Goals:**
- Any Rust that compiles or runs. Rust is quoted text.
- A general-purpose tutorial engine, MDX, a content pipeline, or more questions later.
- Animating anything that would need a motion library — the interactives step on demand or run on a timer the page already knows how to cancel.
- Byte-level diagrams, the TCP handshake state machine, or congestion control. The page answers three interview questions, not a networking course.

## Decisions

### D1 — Simulation arithmetic goes in `lib/learn/`, not inside the components

Three pure functions with unit tests:

```ts
frames(depth, frameBytes, stackBytes): { used: number; fits: boolean; share: number }
deliver(updates, lossPercent, protocol, seed): { arrived: number[]; newestAgeMs: number; stalls: number }
score(answers): { correct: number; total: number }
```

*Why:* it is the convention the whole project follows — `units.ts`, `outcome.ts`, `charts.ts` all keep the arithmetic out of React so it can be tested in milliseconds. It also keeps each interactive a thin renderer of a computed state, which is what makes stepping backwards trivial.

*Determinism:* `deliver` takes a seed and uses a small local pseudo-random generator rather than `Math.random`, so a given loss rate produces the same run every time. A test cannot assert on a coin flip, and a reader comparing the two lanes should be comparing the same losses.

### D2 — The memory visualiser is a list of pre-computed steps, not a simulation

The whole sequence is a constant array of states — which frames are on the stack, what is on the heap, what the caption says — and the control just moves an index.

*Why:* it makes "step back" exact rather than an undo, it makes the content reviewable as data, and it avoids a fake interpreter. The sequence traces the real call path of `placeMarketOrder` (`toValidOrderSize` → `floorToLot` → `toChainUnits`), so the frames on screen are frames this app really pushes.

*Alternative rejected:* instrumenting the real functions to report their own frames. It would need the code under test to know it is being watched, for a page that is not part of the product.

### D3 — Overflow is reported from arithmetic, not by actually recursing

`frames(depth, frameBytes, stackBytes)` answers whether a depth fits. The page never runs a recursion deep enough to crash.

*Why:* a real overflow in the browser would take the page down with it, and in a React tree it can leave the app in a state a reload is the only exit from. The numbers are stated openly (a ~1 MB main-thread stack in V8, 8 MB for a Rust main thread, 2 MB for a spawned one) so the reader can see where the threshold comes from instead of trusting an animation.

*What is real:* the error strings. `RangeError: Maximum call stack size exceeded` and `thread 'main' has overflowed its stack` are shown exactly as each runtime prints them, because recognising them is the useful part.

### D4 — The packet race runs on one timer owned by one component

A single `setInterval` advances both lanes through a precomputed delivery plan from `deliver`. TCP's stall is modelled as the lane waiting the retransmit slots the plan says it waits.

*Why one timer for both:* two timers would drift, and the whole point is comparing the two lanes at the same instant. Cancelling is then a single `clearInterval` in the effect's cleanup, and honouring `prefers-reduced-motion` is simply jumping to the final state instead of starting the timer at all.

### D5 — Code comparison: side by side on a wide screen, tabs on a phone

One `CodeCompare` component takes two labelled snippets and renders both in a two-column grid from `lg:`, or one at a time with a switch below it. The Rust pane is labelled "Rust — for comparison".

*Why the label matters:* someone reading the repository should never be left wondering whether this project contains Rust. The label says what it is, and a task verifies the repository still holds no `.rs` file.

*Why not a syntax highlighter:* it would be a new dependency for a page that is not part of the product. The snippets are short and the app's own monospace styling is enough.

### D6 — The page is a Server Component; only the interactives are client

`app/learn/page.tsx` is static and rendered on the server. Each interactive is its own `"use client"` component. There is no data to fetch, so nothing polls, nothing streams, and the page is the only one in the app that could be statically rendered.

*Consequence worth noting:* this page must not become the place where someone later adds a fetch. If it ever needs data, it needs a route, and a route needs the same envelope and guard rules as every other.

### D7 — `/learn` gets no link, and that is enforced by a test, not a promise

A unit test asserts that `AppNav`'s tab list contains exactly the two hrefs, and a task checks the repository for any `href="/learn"`.

*Why:* "we decided not to link it" is the kind of decision that decays the first time someone adds a footer. A check makes the decision durable, and it is two lines.

## Risks / Trade-offs

- **A page outside the product invites scope creep** ("add a fourth question"). → The proposal's non-goals say three, the spec says exactly three in a stated order, and the quiz is fixed at six questions. A fourth question is a new change.
- **An evaluator may wonder why a trading app contains a networking explainer.** → It is unlinked, so it is only seen when shown deliberately; the README's own section will say plainly that it is separate material and serves no tier of the brief.
- **Quoted Rust can rot** — it is never compiled, so an error in it is invisible to CI. → The snippets are short, idiomatic and deliberately unexciting (`Vec<Candle>`, `Box<T>`, `UdpSocket`), each one paired with the TypeScript it is being compared to, and a task requires reading them back against the language's own documentation before the change is done.
- **The claimed stack sizes are platform-dependent** (V8's ~1 MB, Rust's 8 MB main and 2 MB spawned). → The interactive shows the number it is using and lets the reader see the arithmetic, and the text says these are defaults rather than guarantees. A figure presented as approximate cannot be wrong in the way a figure presented as fact can.
- **Three interactives are three chances to leak a timer or a listener.** → Only one of them uses a timer at all (D4), owned by one component and cancelled in its effect's cleanup; the other two are pure state machines driven by clicks. The reduced-motion path does not start the timer at all.
