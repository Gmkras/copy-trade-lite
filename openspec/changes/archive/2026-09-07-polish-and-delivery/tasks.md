## 1. Remove development overlays (≈15 min)

- [x] 1.1 Set `devIndicators: false` in `next.config.ts`. Verify with agent-browser at 375 px: no framework badge over the bottom navigation on `/`, `/trade` and `/signals/[id]`; the error overlay still appears when a page throws.

## 2. Screen walkthrough at 375 px and 1280 px (≈90 min)

- [x] 2.1 Feed (`/`): count yellow primary actions, scan visible text for jargon, measure every interactive control (≥ 44 px), tab through and confirm the focus ring, check the empty state and the author summary. Fix what fails and re-check. Verify: report the numbers before and after in the commit body; screenshots at both widths.
- [x] 2.2 Trade (`/trade`): same checks, plus the account card's three numbers with units, the collapsible sections' empty states, and the "couldn't refresh" chip wording. Verify: same evidence.
- [x] 2.3 Signal detail (`/signals/[id]`): same checks, plus the chart legend, the copies list and the expired state. Verify: same evidence.
- [x] 2.4 Reduced motion and keyboard: with `prefers-reduced-motion: reduce`, open the sheet and load a screen with skeletons; tab through the trade form and submit with Enter. Verify: no animation runs; the whole form is operable from the keyboard.

## 3. Safety review document (≈45 min)

- [x] 3.1 Write `docs/SAFETY_REVIEW.md` per design D3: the six SAFETY rules mapped to file + function + the verification actually run (with observed results and transaction hashes). Verify: every row's verification column names a command or screen that was executed.
- [x] 3.2 Run and paste the three scans over the whole history (`git log -p | grep -iE "priv|0x[0-9a-f]{64}"`, `grep -rn NEXT_PUBLIC_ .`, `grep -rn MAINNET .`), each with its result. Verify: the secret scan returns nothing but documentation lines; anything else is fixed before continuing.

## 4. README final pass and rehearsal (≈60 min)

- [x] 4.1 Add the "AI-generated vs. what I changed after review" section per design D4 and the five-line biggest-risk note; re-check the Done / Not done table against the app. Verify: every "done" row has a verification elsewhere in the README or in `docs/SAFETY_REVIEW.md`.
- [x] 4.2 Fresh-clone rehearsal per design D5: clone into a temporary folder, follow "Run it locally" verbatim, reach `pnpm smoke` and one order. Verify: note each gap found and fix the README; the rehearsal run is described in the commit body.

## 5. Change review

- [x] 5.1 Run the P-R review prompt on the diff of this change against `specs/constitution.md`. Verify: findings fixed in a separate `fix:` commit, or "no findings" recorded.
