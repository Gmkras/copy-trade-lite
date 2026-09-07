# Safety review

Every rule the brief grades, mapped to the code that enforces it and to the check that was actually run. The verification column reports **observed results**, not intentions: transaction hashes, error messages and command output from this repository.

Reviewed at commit time of the `polish-and-delivery` change. Test suite: 87 tests, 9 files. Production build: green.

## The brief's SAFETY rules

| # | Rule | Enforced in | Verified by (observed) |
|---|---|---|---|
| 1 | **Testnet only.** Mainnet config or real funds anywhere is an automatic fail. | `lib/env.schema.ts` (`envSchema.DECIBEL_NETWORK: z.literal("testnet")`, `loadEnv`), called from `next.config.ts` before any page compiles and from every `tsx` script through `scripts/_env.ts`. `lib/decibel/client.ts` imports **only** `TESTNET_CONFIG`. | Started with `DECIBEL_NETWORK=mainnet`: the dev server refuses to boot with `Failed to load next.config.ts` → `DECIBEL_NETWORK must be exactly "testnet" — mainnet is never allowed`, exit 1. `git grep MAINNET` returns 5 lines, all of them documentation stating the rule; no code. Runtime endpoints observed in `pnpm smoke`: `https://api.testnet.aptoslabs.com/v1` and `/decibel`. |
| 2 | **No secrets in the repo.** A committed key is an automatic fail. | `.gitignore` line 2 (`.env`, `.env.*`, `!.env.example`) and line 9 (`data/`), both present in the **first** commit, before any `.env` existed. Keys are read only in `lib/env.schema.ts`; no script prints them (`scripts/keygen.ts` prints a key it just generated, by design, and says so). | `git ls-files | grep .env` → only `.env.example`. `git log -p | grep -iE "ed25519-priv|0x[0-9a-f]{64}"` → 6 matches, all of them public transaction hashes in the README plus the literal string `"ed25519-priv-0x…"` used as a *format example* in `.env.example`. No key material in the history. `git check-ignore data/signals.db` → ignored. |
| 3 | **`builderFee` must never exceed the approved `maxFee`.** | The fee is a server constant: `BUILDER_FEE_BPS` is validated `0..10` at startup (`lib/env.schema.ts`) and exposed as `feeBps` by `lib/decibel/client.ts`. `assertFeeBound(feeBps, approvedMax)` in `lib/decibel/orders.ts` runs **immediately before** the transaction is built and throws unless `fee ≤ approved ≤ 10`. The approval recorded by `pnpm approve` lives in `data/builder-approval.json`. **No request schema has a fee field**, and both order schemas are `.strict()`. | Approved 5 bps with an env override, then placed an order with the configured 10: rejected before any transaction with `Builder fee 10 bps exceeds the approved maximum of 5 bps. Run pnpm approve to raise it (cap 10 bps).` Restored to 10 bps. `POST /api/order` with `{"builderFee":1}` → `422 Unexpected field: builderFee.` Same for `price` and `builderAddr`. Unit tests cover the bound (`lib/decibel/orders.test.ts`). |
| 4 | **Validate user input before signing.** Size > 0, no `NaN`, TP/SL on the correct side, address padded to 64 chars. | `toValidOrderSize` (`lib/decibel/units.ts`): finite, > 0, ≥ market minimum after lot flooring, ≤ `MAX_ORDER_SIZE`; every message names the allowed range. `assertTpSlSides` (`lib/decibel/orders.ts`). `padAddress` (`lib/decibel/client.ts`) left-pads the builder address to 64 hex characters. Percentages and hold time are bounded by `SignalInput` (`lib/schemas.ts`). Every route parses with a `.strict()` schema as its first step (`lib/api.ts`). | `size:"abc"`, `size:0`, `size:5` → `422` with `Size must be a number between 0.00002 and 0.01 BTC.` / `That's more than this app allows in one order…`, and **no transaction is sent** (unit tests assert `placeOrder` was never called). `tpPct:0`, `slPct:150`, `holdHours:1000` → 422 each. Builder address observed as `0x` + 64 chars in `pnpm smoke`. 41 unit tests cover units, order bounds and schemas. |
| 5 | **Handle the unhappy path.** Nothing crashes or silently "succeeds". | `TradeError` with 12 codes and `humanizeSdkError` (`lib/decibel/errors.ts`) translate SDK and chain errors into one readable sentence, always keeping the original on `cause`. `apiHandler` (`lib/api.ts`) maps zod → 422, `TradeError` → 422, `NotFoundError` → 404, anything else → 502 with a safe message plus a server log. `placeMarketOrder` never returns success without a transaction hash. An account with no deposit answers 404 upstream and is reported as an **empty account**, not an error (`isNotFoundError`). | Wrong API key → `Your Geomi API key was rejected. Create a Testnet key at https://geomi.dev…`, exit 1, no stack trace, no secret. Exhausted mint allowance → refused *before* any transaction, with the reset time. Copying an expired idea → `422 SIGNAL_EXPIRED`, no order. Blocking `/api/account` in the browser → the numbers stay and a "couldn't refresh" chip appears. A unit test asserts a 502 body contains no stack, URL or key. |
| 6 | **Don't fake it.** | `README.md` lists what is done and what is not, per tier, with the transaction hashes that prove each claim; the "What's next" section names the four things that are missing. Copies record the **reference** price, not a confirmed fill, and the interface says "at about $…"; a copy whose order succeeded but whose database write failed still reports the order as placed and logs the failure loudly (`app/api/signals/[id]/copy/route.ts`). | Every "done" row in the README maps to a command or screen in its own checklist. The MUST and SHOULD proofs are on the public explorer: order from the script `0x5f43…6875`, builder approval `0x0c23…8f24`, order from the Trade screen `0x9e32…f7af`, one-tap copy `0x54c0…dff3`. |

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
                  (zod .strict())    (size, TP/SL,
                                      fee bound)
                        │
                        └── lib/decibel/index.ts and lib/signals/index.ts import "server-only":
                            a Client Component importing them fails the build.
```

Verified by adding `import { env } from "@/lib/env"` to a Client Component: `pnpm build` fails with `You're importing a module that depends on "server-only"`. Removing the line makes it pass. A production build's client assets contain neither the private key nor the API key.

## Biggest risk in this submission

The private key lives on the server and the two write routes (`POST /api/order`, `POST /api/signals/[id]/copy`) have no authentication, so anyone who can reach the app can spend the testnet balance. It is mitigated by keeping the app on localhost (documented in the README, no deployment config in the repo), by `server-only` modules that keep the key out of the browser, by an environment guard that refuses anything but testnet, by a per-order size cap (`MAX_ORDER_SIZE`), and by the builder-fee bound asserted immediately before signing. The real fix, and the next step I would take, is wallet-based signing in the browser so each person copies from their own account and the server never holds a key.
