## Why

Two scenarios in the `app-shell` main spec still describe placeholders that no longer exist: the home was replaced by the ideas feed in `copy-trade-signals`, and `/trade` stopped being a "coming soon" page in `trade-screen`. A main spec is supposed to describe what the product does **today**; leaving them there means the spec and the app disagree, and one of them is lying.

**Tier served:** none — documentation accuracy. Found while merging the `polish-and-delivery` delta.

## What Changes

- Retire **Visual foundation follows the constitution** and replace it with **Visual foundation holds on every screen**: same tokens, fonts, minimum text size and tap-target rule, but the "Placeholder home" scenario becomes the feed as it exists now, plus one that checks the palette on the other two screens.
- Retire **Two-tab navigation** and replace it with **Two-tab navigation between built screens**: the surviving "Switching tabs" scenario is kept and "Route not yet built" becomes a scenario stating that both tabs lead to a working screen.
- The retire-and-replace shape is what the schema supports: a MODIFIED block cannot drop a scenario, and a REMOVED plus ADDED pair may not reuse the same requirement name. Both successors keep every guarantee of the original.
- No code changes: the app already behaves this way. This change only makes the spec say so.

## Capabilities

### Modified Capabilities
- `app-shell`: two scenarios updated so the spec matches the shipped screens.

## Non-goals

- No new behaviour, no refactor, no UI change.
- The other nine requirements of `app-shell` stay exactly as they are.

## Impact

- Touches `openspec/specs/app-shell/spec.md` only, through the delta in this change.
- Nothing to verify at runtime beyond confirming the described behaviour is what the app already does.
