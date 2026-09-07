## Context

Five screens exist and work: feed (`/`), trade (`/trade`), signal detail (`/signals/[id]`), plus the placeholder-free navigation and toasts. 87 tests, production build green, four capabilities archived. Known rough edges going in: the Next.js dev-tools button overlaps the bottom navigation at 375 px (seen in every screenshot), and the walkthrough of §1/§5 of the constitution has never been done end to end. See proposal.md for why this change exists.

## Goals / Non-Goals

**Goals:**
- Find defects by *looking*, at both widths, with the constitution as the checklist — not by guessing.
- Produce the two documents a grader reads: an honest README and a safety review that maps rules to code.
- Rehearse the reviewer's first five minutes (fresh clone → order) so it cannot fail on the day.

**Non-Goals:**
- New features, redesign, deployment.

## Decisions

### D1. Walkthrough method
For each screen, at 375 px and 1280 px, drive the real app with agent-browser and record: the count of yellow primary actions, a jargon scan of the visible text, the computed height of every interactive control, the focus ring on tab, the empty states, and a screenshot. Fix what fails, re-check, keep the before/after in the change notes. Alternative: eyeball the screenshots — rejected, the measurable checks (tap size, jargon, focus) are exactly the ones that slip.

### D2. Dev indicator
`devIndicators: false` in `next.config.ts`. It removes the floating badge in development; the error overlay stays. Alternative: leave it and avoid it in the recording — rejected, it overlaps the navigation and a reviewer running `pnpm dev` sees it too.

### D3. `docs/SAFETY_REVIEW.md` structure
One table with a row per SAFETY rule from the brief: rule → where it is enforced (file + function) → how it was verified (command or screen, with the observed result). Then the raw output of three scans run over the whole history: `git log -p | grep -iE "priv|0x[0-9a-f]{64}"`, `grep -rn NEXT_PUBLIC_`, `grep -rn MAINNET`. Then the five-line note on the biggest risk. Keeping the verification column filled with *observed* results (transaction hashes, error messages) is what makes it a review rather than a claim.

### D4. "AI-generated vs. what I changed" section
Built from evidence already in the repo: `openspec/changes/archive/*` (what was planned before any code), the `fix:` commits (what the P-R review changed) and the implementation notes in each `design.md` / `*.old` file (where reality contradicted the plan). Written as a short list of the decisions and corrections that mattered, not a diff dump.

### D5. Fresh-clone rehearsal
Clone the repository into a temporary folder, copy `.env` by hand (never committed), run the README steps verbatim with the same commands, and note every place where the README was incomplete or wrong. Fix the README, not the memory of it.

## Risks / Trade-offs

- [The walkthrough finds a large defect late] → fix only what breaks a constitution rule; anything cosmetic goes to "What's next" instead of a rushed change.
- [Time spent polishing is time not spent on STRETCH] → deliberate: the brief weighs a polished demo path and an honest README above breadth.
- [The rehearsal needs testnet funds again] → the mint allowance resets daily; if it is exhausted the rehearsal stops at `pnpm smoke`, which still proves the credentials path, and the README says so.

## Migration Plan

None; no data or API changes.

## Open Questions

None.
