# Safety review

Every rule the brief grades, mapped to the code that enforces it and to the check that was actually run. The verification column reports **observed results**, not intentions: transaction hashes, error messages and command output from this repository.

Reviewed at commit time of the `deploy-demo` change, against the deployed app at <https://copy-trade-lite-gilt.vercel.app>. Test suite: 93 tests, 10 files. Production build: green.

## The brief's SAFETY rules

| # | Rule | Enforced in | Verified by (observed) |
|---|---|---|---|
| 1 | **Testnet only.** Mainnet config or real funds anywhere is an automatic fail. | `lib/env.schema.ts` (`envSchema.DECIBEL_NETWORK: z.literal("testnet")`, `loadEnv`), called from `next.config.ts` before any page compiles and from every `tsx` script through `scripts/_env.ts`. `lib/decibel/client.ts` imports **only** `TESTNET_CONFIG`. | Started with `DECIBEL_NETWORK=mainnet`: the dev server refuses to boot with `Failed to load next.config.ts` → `DECIBEL_NETWORK must be exactly "testnet" — mainnet is never allowed`, exit 1. `git grep MAINNET` returns 5 lines, all of them documentation stating the rule; no code. Runtime endpoints observed in `pnpm smoke`: `https://api.testnet.aptoslabs.com/v1` and `/decibel`. The deployment carries `DECIBEL_NETWORK=testnet` as an environment variable and the same guard runs there: every explorer link the live app produced is `?network=testnet`. |
| 2 | **No secrets in the repo.** A committed key is an automatic fail. | `.gitignore` line 2 (`.env`, `.env.*`, `!.env.example`) and line 9 (`data/`), both present in the **first** commit, before any `.env` existed. Keys are read only in `lib/env.schema.ts`; no script prints them (`scripts/keygen.ts` prints a key it just generated, by design, and says so). | `git ls-files | grep .env` → only `.env.example`. `git log -p | grep -iE "ed25519-priv|0x[0-9a-f]{64}"` → 6 matches, all of them public transaction hashes in the README plus the literal string `"ed25519-priv-0x…"` used as a *format example* in `.env.example`. No key material in the history. `git check-ignore data/signals.db` → ignored. On the deployment the key, the Geomi key, the database token and the demo code exist only as Vercel environment variables; the served HTML of `/` and `/trade` plus every client chunk (614 KB) were fetched and searched for all four values and for the Turso host: 0 matches. The database itself stores no secrets (ideas, copies, addresses, a fee cap, public hashes). |
| 3 | **`builderFee` must never exceed the approved `maxFee`.** | The fee is a server constant: `BUILDER_FEE_BPS` is validated `0..10` at startup (`lib/env.schema.ts`) and exposed as `feeBps` by `lib/decibel/client.ts`. `assertFeeBound(feeBps, approvedMax)` in `lib/decibel/orders.ts` runs **immediately before** the transaction is built and throws unless `fee ≤ approved ≤ 10`. The approval recorded by `pnpm approve` is a row in `builder_approvals` in the database at `DATABASE_URL` (it was a local file until the first deployment showed that a serverless host never has it). **No request schema has a fee field**, and both order schemas are `.strict()`. | Approved 5 bps with an env override, then placed an order with the configured 10: rejected before any transaction with `Builder fee 10 bps exceeds the approved maximum of 5 bps. Run pnpm approve to raise it (cap 10 bps).` Restored to 10 bps. `POST /api/order` with `{"builderFee":1}` → `422 Unexpected field: builderFee.` Same for `price` and `builderAddr`. Unit tests cover the bound (`lib/decibel/orders.test.ts`). Observed on the deployment before the record was moved: every order refused with `422 FEE_BOUND` and no transaction — the bound fails closed when it has no record. |
| 4 | **Validate user input before signing.** Size > 0, no `NaN`, TP/SL on the correct side, address padded to 64 chars. | `toValidOrderSize` (`lib/decibel/units.ts`): finite, > 0, ≥ market minimum after lot flooring, ≤ `MAX_ORDER_SIZE`; every message names the allowed range. `assertTpSlSides` (`lib/decibel/orders.ts`). `padAddress` (`lib/decibel/client.ts`) left-pads the builder address to 64 hex characters. Percentages and hold time are bounded by `SignalInput` (`lib/schemas.ts`). Every route parses with a `.strict()` schema as its first step (`lib/api.ts`). | `size:"abc"`, `size:0`, `size:5` → `422` with `Size must be a number between 0.00002 and 0.01 BTC.` / `That's more than this app allows in one order…`, and **no transaction is sent** (unit tests assert `placeOrder` was never called). `tpPct:0`, `slPct:150`, `holdHours:1000` → 422 each. Builder address observed as `0x` + 64 chars in `pnpm smoke`. 41 unit tests cover units, order bounds and schemas. |
| 5 | **Handle the unhappy path.** Nothing crashes or silently "succeeds". | `TradeError` with 12 codes and `humanizeSdkError` (`lib/decibel/errors.ts`) translate SDK and chain errors into one readable sentence, always keeping the original on `cause`. `apiHandler` (`lib/api.ts`) maps zod → 422, `TradeError` → 422, `NotFoundError` → 404, `UnauthorizedError` → 401, anything else → 502 with a safe message plus a server log. An unreachable database is caught by the feed page (plain message, no connection string) and by `app/error.tsx` elsewhere; orders never touch the database, so the Trade screen keeps working. `placeMarketOrder` never returns success without a transaction hash. An account with no deposit answers 404 upstream and is reported as an **empty account**, not an error (`isNotFoundError`). | Wrong API key → `Your Geomi API key was rejected. Create a Testnet key at https://geomi.dev…`, exit 1, no stack trace, no secret. Exhausted mint allowance → refused *before* any transaction, with the reset time. Copying an expired idea → `422 SIGNAL_EXPIRED`, no order. Blocking `/api/account` in the browser → the numbers stay and a "couldn't refresh" chip appears. A unit test asserts a 502 body contains no stack, URL or key. `DATABASE_URL` pointed at an unreachable `libsql://` host on a production build → `/` answers 200 with "Ideas are unavailable — we couldn't load the ideas right now…"; the HTML contains neither the host nor a stack. |
| 6b | **Don't fake it — outcomes.** An idea's result is settled from candles, and the app never claims a win it cannot prove. | `settleSignal` in `lib/signals/outcome.ts`: a candle that reached **both** levels records `sl`, because the order of the two moves inside one candle is unknowable; an outcome is written once (`UPDATE … WHERE outcome IS NULL`) and never recomputed; settlement reads candles, never fills, so an idea nobody copied is judged by the same rule. | Unit tests cover Up, Down, the exact level, both-levels-in-one-candle → `sl`, expiry with and without candles, and candles outside the window. Live: an idea with a take profit 0.01 % above the entry was posted and settled `tp` within two minutes; on the next reload it was still `tp` although the price had moved past both levels, and its author's record read `settled: 1, won: 1`. |
| 6 | **Don't fake it.** | `README.md` lists what is done and what is not, per tier, with the transaction hashes that prove each claim; the "What's next" section names the four things that are missing. Copies record the **reference** price, not a confirmed fill, and the interface says "at about $…"; a copy whose order succeeded but whose database write failed still reports the order as placed and logs the failure loudly (`app/api/signals/[id]/copy/route.ts`). | Every "done" row in the README maps to a command or screen in its own checklist. The MUST and SHOULD proofs are on the public explorer: order from the script `0x5f43…6875`, builder approval `0x0c23…8f24`, order from the Trade screen `0x9e32…f7af`, one-tap copy `0x54c0…dff3`; from the deployed URL, order `0xf2bc…d027` and copy `0x9503…909b`. |
| 7 | **Writes on the public URL are gated** (this submission's own rule: a deployed link must not hand the shared key to anyone who finds it). | `assertDemoAccess` (`lib/auth.ts`): no-op when `DEMO_PASSCODE` is empty; otherwise a `timingSafeEqual` compare of the `x-demo-passcode` header, throwing `UnauthorizedError` whose message never contains the expected value. Declared as the `guard` of `POST /api/order`, `POST /api/signals` and `POST /api/signals/[id]/copy` in `apiHandler`, which runs it **before the body is read**. Read routes have no guard. The browser keeps the code in `localStorage` (try/catch) and sends it only as that header (`hooks/useDemoPasscode.ts`). | On the deployment: the three writes without the header → `401 DEMO_CODE_REQUIRED`, in 12–60 ms, no transaction; with a wrong value → 401; with the code → 200 and a real transaction. `GET` feed, detail, markets, price and account → 200 with no header. In a browser with cleared storage: the first tap on Buy opens the prompt, a wrong code says "That code wasn't accepted", the right one places the order and the next tap does not ask. Locally with the variable empty, the same routes answer 200 with no header (`lib/auth.test.ts`, 5 cases; `lib/api.test.ts` covers the 401 mapping). |

## Scans over the whole history

```
$ git log -p | grep -iE "ed25519-priv|0x[0-9a-f]{64}"
6 matches — all of them public transaction hashes quoted in README.md, plus this
line from .env.example (a format example, not a value):
  # Format: hex with or without 0x, or the "ed25519-priv-0x…" AIP-80 string.

$ git grep -n "NEXT_PUBLIC_"
4 matches — all documentation stating the rule (CLAUDE.md, specs/constitution.md,
openspec/changes/polish-and-delivery/*). No source file defines or reads one.

$ git grep -n "MAINNET"
5 matches — all documentation stating the rule. No source file imports
MAINNET_CONFIG or names a mainnet URL.

$ git ls-files | grep "\.env"
.env.example
```

## Where the boundary is

```
browser ──HTTP──> Route Handler ──> placeMarketOrder ──> @decibeltrade/sdk ──> Aptos testnet
                  (guard: demo       (size, TP/SL,
                   code, then zod     fee bound from the
                   .strict())         builder_approvals row)
                        │
                        └── lib/decibel/index.ts and lib/signals/index.ts import "server-only":
                            a Client Component importing them fails the build.

                  Route Handler ──> @libsql/client ──> file:./data/signals.db (local)
                                                   ──> libsql://…turso.io      (deployed)
```

Verified by adding `import { env } from "@/lib/env"` to a Client Component: `pnpm build` fails with `You're importing a module that depends on "server-only"`. Removing the line makes it pass. The deployed client assets contain neither the private key, the API key, the database token nor the demo code (searched, 0 matches).

## Biggest risk in this submission

One testnet private key lives on the server and signs every order, so anyone who can call the write routes of the public URL could spend the shared testnet balance. It is mitigated by a demo passcode checked before the body of those routes is read (`401` without it, observed on the deployment; reads stay open on purpose), by `server-only` modules that keep the key out of the browser (the live bundle was scanned: no key, token or code), by an environment guard that refuses anything but testnet, by a per-order size cap (`MAX_ORDER_SIZE`), and by the builder-fee bound asserted immediately before signing. A shared code is a demo gate, not authentication: the real fix, and the next step I would take, is wallet-based signing in the browser so each person copies from their own account and the server never holds a key.
