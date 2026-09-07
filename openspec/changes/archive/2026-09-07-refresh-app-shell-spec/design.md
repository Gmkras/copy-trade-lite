## Context

`openspec/specs/app-shell/spec.md` is the living description of the shell. Two of its scenarios were written when the screens they describe were placeholders; both were replaced by later changes (`trade-screen`, `copy-trade-signals`) whose deltas touched their own capabilities and left `app-shell` untouched. See proposal.md for why this matters.

## Goals / Non-Goals

**Goals:**
- The main spec describes the shipped app, so a reader can trust it.
- Nothing else in `app-shell` moves.

**Non-Goals:**
- Any code change; the behaviour is already correct.

## Decisions

### D1. REMOVED + ADDED, because MODIFIED cannot retire a scenario
First attempt used MODIFIED, on the assumption that a modified block simply replaces the requirement. `openspec validate` refused it:

```
MODIFIED "Visual foundation follows the constitution" omits scenario(s) the current
spec still has: "Placeholder home". Copy them into the MODIFIED block (a MODIFIED
requirement replaces the whole block, so archive refuses to drop them).
```

That guard exists so a careless MODIFIED cannot silently delete guarantees — exactly the risk noted below — but it also means MODIFIED can only *add or edit* scenarios, never retire one. Retiring a scenario requires REMOVED (with a reason and a migration note) followed by ADDED of the same requirement carrying its surviving scenarios. Both requirements keep their name and their guarantees; only the stale scenarios disappear. The first version of this file is kept as `design.md.old`, and the first delta as `spec.md.old`.

A second attempt used REMOVED + ADDED under the *same* requirement names, and validation refused that too: `Requirement present in both ADDED and REMOVED`. So the supported way to retire a scenario is to retire the requirement and add a **successor with its own name**, which is what this change does: "Visual foundation follows the constitution" → "Visual foundation holds on every screen", and "Two-tab navigation" → "Two-tab navigation between built screens". Both successors keep every guarantee of the original and gain a scenario that describes the shipped app. The two rejected attempts are kept as `spec.md.old` and `spec.md.old2`.

*Alternative considered:* keep the scenario names and only rewrite their bodies, which would satisfy MODIFIED. Rejected: "Placeholder home" and "Route not yet built" are the wrong names for what the app does now, and a spec that keeps a misleading name is only half honest.

### D2. Wording that will not go stale again
The replacements describe *properties* rather than a moment in the project's life: "the ideas feed renders on a black background with yellow as the only strong accent" and "neither is a placeholder and neither is a 404". A scenario phrased as "the screen has not been implemented yet" is guaranteed to expire; one phrased as an invariant is not.

## Risks / Trade-offs

- [The merge drops the surviving scenario] → the archive step compares requirement and scenario counts before moving anything; expected result is 11 requirements and 24 scenarios, unchanged.

## Migration Plan

None.

## Open Questions

None.
