## Context

The app runs on Node 24 with `node:sqlite` (synchronous) behind an injectable repository (`createRepo(db)`), which is what makes this swap tractable. Eight files touch the repository: three signal routes, two server components, the repo, its tests and the server-only gate. Platform facts checked before writing this: `node:sqlite` is **stubbed** in Cloudflare Workers (`DatabaseSync` is not constructible), so Cloudflare would be a rewrite, not a deploy; Vercel runs Next.js natively but its filesystem is ephemeral, so a `.db` file does not survive between invocations. See proposal.md for the decision to publish at all.

## Goals / Non-Goals

**Goals:**
- One code path for local and deployed: same SQL, same schema, only the URL differs.
- A public link that a reviewer can browse freely and operate with a code sent alongside it.
- Documentation that describes the deployed app, not the one that only ran on localhost.

**Non-Goals:**
- Real authentication, accounts or per-user wallets.
- Any change to how an order is priced, bounded or signed.

## Decisions

### D1. `@libsql/client` replaces `node:sqlite`
libSQL is SQLite's protocol over HTTP with the same dialect, so `SCHEMA_SQL` and every statement stay as they are. `createClient({ url, authToken })` accepts `file:./data/signals.db` locally and `libsql://…turso.io` in production, which keeps a single implementation. Alternatives: keep `node:sqlite` locally and add libSQL only in production — rejected, two persistence paths means the deployed one is the untested one; Vercel Postgres or Neon — rejected, they would mean rewriting the SQL for no gain.

### D2. The repository becomes asynchronous
`@libsql/client` returns promises, so `createSignal`, `listSignals`, `getSignal`, `listCopies`, `addCopy` and `authorStats` become `async`, and their eight call sites `await` them. The two server components (`app/page.tsx`, `app/signals/[id]/page.tsx`) already are `async`, so only their helper functions change shape. Rows arrive as `Row` objects and are still parsed with the same zod schemas before leaving the module, so a drift still fails loudly. Alternative: a synchronous wrapper — impossible over HTTP.

### D3. Schema creation stays lazy, but once per process
`ensureSchema()` runs the `CREATE TABLE IF NOT EXISTS` batch on first use and caches the promise, so concurrent requests on a cold serverless instance do not race. libSQL's `batch` runs the statements in one round trip.

### D4. The passcode is a header, checked in one place
`lib/auth.ts` exports `assertDemoAccess(request)`: if `env.DEMO_PASSCODE` is empty it returns immediately; otherwise it compares the `x-demo-passcode` header and throws `UnauthorizedError` (mapped to `401` by `apiHandler`, next to the existing `NotFoundError` → `404`). Every write route calls it as its first statement, before the body is even parsed. The comparison uses `timingSafeEqual` on equal-length buffers — cheap, and it avoids explaining a timing leak in the review. Alternatives: Vercel's built-in password protection — rejected, it is a paid feature and it would also block reading, which we want open; middleware — rejected, keeping the check inside the routes puts it in the same file as the thing it protects.

### D5. The client remembers the code, and asks only when refused
`hooks/useDemoPasscode.ts` reads and writes `localStorage` (wrapped in try/catch, as the constitution requires) and `postEnvelope` sends the header when a value exists. On a `401` the caller shows a small prompt — a `Sheet` with one input, reusing the existing component — and retries once with the new value. Nothing displays the stored value except the input the user typed it into, and it is never logged. A local clone never sees the prompt because the server never answers `401`.

### D6. What the reviewer receives
The README gets a "Try the deployed demo" block at the top: the URL, the sentence "browsing is open; to place a trade you need the demo code included in the submission email", and a reminder that everything is testnet play money. The "localhost only" warning becomes a "what protects the deployed app" note. `docs/SAFETY_REVIEW.md` rows for rules 1, 2 and 5 gain the deployment column, and the biggest-risk note is rewritten around the passcode instead of localhost.

## Risks / Trade-offs

- [The shared testnet balance runs out while the reviewer is trying it] → the passcode keeps casual visitors out, `MAX_ORDER_SIZE` caps each order at about $1.60, and the README says how to mint more; if it empties, the account card and the error message say so plainly rather than failing silently.
- [Turso free tier limits or an outage] → the feed degrades to a readable message (spec scenario "Unreachable database"), and the app keeps trading, because orders do not touch the database.
- [The passcode leaks] → it is a demo gate on testnet funds, not a secret; it can be rotated by changing one environment variable and redeploying.
- [Cold starts on Vercel make the first request slow] → the same ~8 s first-hit compile we already see locally; the README warns the reviewer.
- [Async conversion breaks something subtle] → the repository has tests that run against an in-memory database and will run unchanged against `file::memory:`.

## Migration Plan

Local: `DATABASE_URL` defaults to `file:./data/signals.db`, so an existing database keeps working. Deployment: create the Turso database, set the four environment variables in Vercel, deploy. Rollback: unset `DEMO_PASSCODE` and point `DATABASE_URL` back at a file to return to the previous behaviour.

## Open Questions

None blocking. Whether to seed the deployed database with two example ideas so the feed is not empty for the first visitor is a judgement call at deploy time; if I do, the README says they are mine.
