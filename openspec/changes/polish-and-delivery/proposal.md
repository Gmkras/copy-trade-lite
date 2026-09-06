## Why

MUST and SHOULD are archived and working. The brief says the reviewer runs the demo path first and grades honesty explicitly: "polish the demo path; we'll run exactly that path first" and "if a feature doesn't work, say so in the README". This change spends the remaining time where it scores, instead of adding features.

**Tier served:** none — it hardens what MUST and SHOULD already deliver and produces the submission artifacts the brief lists (README, safety note, proof it runs).

## What Changes

- **Design pass** over the five screens at 375 px and 1280 px against `specs/constitution.md` §1 and §5: exactly one yellow primary action per screen, plain words only, every number with context, inviting empty states, actionable errors, visible focus rings, tap targets ≥ 44 px, skeletons instead of spinners, `prefers-reduced-motion` respected. Whatever does not help a 12-year-old is removed.
- **Turn off the Next.js dev-tools indicator** (`devIndicators: false`), which overlaps the bottom navigation at 375 px and would be visible in the recording.
- **`docs/SAFETY_REVIEW.md`**: a table mapping each of the brief's six SAFETY rules to the file and function that enforces it and to the command or screen that verified it, plus the output of the secret, mainnet and public-prefix scans over the whole history.
- **README final pass**: an "AI-generated vs. what I changed after review" section built from the archived OpenSpec changes and the `fix:` commits, the ~5-line biggest-risk note, and a "Done / Not done" table that matches reality.
- **A fresh-clone rehearsal**: clone into a new folder, follow the README literally, and place one order — the exact experience the reviewer will have.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `app-shell`: adds requirements for the accessibility and motion guarantees that now apply to every screen, and for keeping development-only overlays out of the app.

## Non-goals

- No new features: no profile switcher, no outcome marking, no leaderboard, no WebSocket. Those stay listed as not done.
- No deployment: the app remains localhost-only, as documented.
- No redesign; only the corrections the walkthrough finds.

## Impact

- Touches `next.config.ts`, `app/globals.css` and the screen components only where the walkthrough finds a defect.
- New file `docs/SAFETY_REVIEW.md`; README updated.
- The recording itself is produced from `../LOOM_SCRIPT.md`, which lives outside the repo.
