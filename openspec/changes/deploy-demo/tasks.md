## 1. Persistence on libSQL (≈75 min)

- [ ] 1.1 Add `@libsql/client`, drop `node:sqlite`. Rewrite `lib/signals/db.ts`: `createClient({ url: DATABASE_URL, authToken: DATABASE_AUTH_TOKEN })`, `ensureSchema()` running the `CREATE TABLE IF NOT EXISTS` batch once per process (cached promise), same schema text. Add `DATABASE_URL` (default `file:./data/signals.db`), `DATABASE_AUTH_TOKEN` (optional) and `DEMO_PASSCODE` (optional) to `lib/env.schema.ts` and `.env.example`; keep `DB_PATH` out. Verify: `pnpm typecheck` exits 0.
- [ ] 1.2 Convert `lib/signals/repo.ts` to async (all six functions), keeping the zod row parsing and the prepared-statement style (`db.execute({ sql, args })`). Update `lib/signals/repo.test.ts` to await, running against `file::memory:`. Verify: `pnpm test` green with the same six repository cases passing.
- [ ] 1.3 Await the repository in its eight call sites: three signal routes, `app/page.tsx`, `app/signals/[id]/page.tsx`. Verify: `pnpm typecheck` and `pnpm lint` exit 0; with the dev server, `GET /api/signals` returns the ideas already stored in `data/signals.db`, `POST /api/signals` creates one, and a copy still records (curl the three).
- [ ] 1.4 Unreachable-database behaviour: point `DATABASE_URL` at an unreachable libsql URL and open the feed. Verify: a plain-language message, no stack trace and no connection string on screen; restore the URL afterwards.

## 2. Demo passcode (≈45 min)

- [ ] 2.1 Create `lib/auth.ts` with `UnauthorizedError` and `assertDemoAccess(request)` per design D4 (no-op when unset, constant-time compare otherwise); map `UnauthorizedError` → 401 in `lib/api.ts`. Add unit tests: unset passes, correct header passes, missing and wrong header throw, and the error message never contains the expected value. Verify: `pnpm test` green.
- [ ] 2.2 Call `assertDemoAccess` as the first statement of `POST /api/order`, `POST /api/signals` and `POST /api/signals/[id]/copy`. Verify with `DEMO_PASSCODE` set: each write without the header returns 401 and places no order; with the header, all three work; every GET keeps working without a header. With the variable unset, all three work with no header.
- [ ] 2.3 Create `hooks/useDemoPasscode.ts` (localStorage in try/catch) and a prompt in the UI: on a 401 the user is asked for the code, it is stored and the action retried once. Wire it into `TradeForm`, `PostIdeaSheet` and `CopyPanel`. Verify with agent-browser at 375 px against a dev server with `DEMO_PASSCODE` set: the first order asks for the code, a wrong code says so and lets you retry, the right one completes the order and a second action does not ask again.

## 3. Deploy (≈45 min)

- [ ] 3.1 Create the Turso database and load the schema; set `DATABASE_URL` and `DATABASE_AUTH_TOKEN` locally and confirm the app works against it (post an idea, copy it, restart, they are still there). Record the database name in the commit body, never the token.
- [ ] 3.2 Create the Vercel project from the GitHub repository with the six environment variables (`PRIVATE_KEY`, `APTOS_NODE_API_KEY`, `BUILDER_ADDRESS`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `DEMO_PASSCODE`) plus `BUILDER_FEE_BPS`, `DECIBEL_NETWORK` and `MAX_ORDER_SIZE`. Verify: the build succeeds and the deployed URL serves the feed.
- [ ] 3.3 Run the full demo path on the deployed URL from a phone-sized viewport: browse without the code, then enter it, place a trade, post an idea, copy it, check the position. Verify: record the two transaction hashes from the deployed app in the commit body; confirm reading works in a private window without the code and writing does not.

## 4. Honest documentation (≈40 min)

- [ ] 4.1 README: "Try the deployed demo" block at the top (URL, browsing is open, the code comes with the submission, testnet play money, first request may take a few seconds); replace the "localhost only" warning with what protects the deployed app; add "Deploy your own" (Turso + Vercel, the variables); update the status table and the run-it-locally steps where `DB_PATH` was mentioned. Verify: a reader who only has the URL and the code can complete the demo path.
- [ ] 4.2 `docs/SAFETY_REVIEW.md`: update rules 1, 2 and 5 for the deployment (where the key lives now, that the database holds no secrets, that writes are gated), add a row for the passcode with its observed 401, and rewrite the five-line biggest-risk note around the passcode instead of localhost. Verify: no sentence in the file claims localhost-only any more.

## 5. Change review

- [ ] 5.1 Run the P-R review prompt on the diff against `specs/constitution.md`, with two extra questions for this change: can any write reach the exchange without `assertDemoAccess`, and does any response, log or client bundle contain the passcode, the auth token or the private key. Verify: findings fixed in a separate `fix:` commit, or "no findings" recorded.
