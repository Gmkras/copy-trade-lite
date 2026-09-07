## Why

The brief accepts either a recording or "a deployed link we can click". A link lets the reviewer try the copy-trade flow on their own phone, which is a better proof than watching me do it. Two things stand between the current app and a public URL: its database is a local file that a serverless filesystem throws away, and its two write routes sign with the server's key without any authentication — which is exactly why the README says "localhost only" today.

**Tier served:** none — it changes how the finished app is delivered.

## What Changes

- **Persistence moves to libSQL.** `@libsql/client` replaces Node's built-in `node:sqlite`: the same SQL, the same schema, `file:./data/signals.db` locally and a `libsql://` URL (Turso) in production. The client is asynchronous, so the repository and every caller become `async`.
- **Write routes require a demo passcode.** When `DEMO_PASSCODE` is set, `POST /api/order`, `POST /api/signals` and `POST /api/signals/[id]/copy` demand it in an `x-demo-passcode` header and answer `401` without it. Reading stays open, so anyone with the link can browse ideas and charts. The interface asks for the code once and remembers it in the browser. With the variable unset — the default for a local clone — nothing changes.
- **Deployment configuration**: the environment schema gains `DATABASE_URL`, `DATABASE_AUTH_TOKEN` and `DEMO_PASSCODE`; `.env.example` documents all three; the README gains a "Deploy your own" section.
- **Honest documentation**: the README status table, the "localhost only" warning, `docs/SAFETY_REVIEW.md` and the biggest-risk note are rewritten to describe the app as published, because leaving them as they are would be a false claim about the very thing the brief grades.

## Capabilities

### Modified Capabilities
- `copy-trade-signals`: the persistence requirement stops naming a local file and describes durable storage that survives restarts and redeploys.
- `trading`: adds the authenticated-writes requirement that applies to every route that can sign a transaction.
- `app-shell`: the environment requirement lists `DATABASE_URL`, `DATABASE_AUTH_TOKEN` and `DEMO_PASSCODE` instead of `DB_PATH`, and states that a clone with no database configuration still starts.

## Non-goals

- No real authentication or user accounts: the passcode is a shared demo gate, not a login, and the README says so.
- No new features, no visual changes beyond the passcode prompt.
- No change to how orders are placed: the same `placeMarketOrder`, the same bounds, the same builder-fee assertion.

## Impact

- `lib/signals/{db,repo,index}.ts` and its tests become async; the three signal routes and the two server components that read the repository await it.
- New dependency `@libsql/client`; `node:sqlite` is dropped.
- New files: `lib/auth.ts` (passcode check), a small client component for the prompt.
- External services: a Turso database and a Vercel project, both on free plans that do not expire.
