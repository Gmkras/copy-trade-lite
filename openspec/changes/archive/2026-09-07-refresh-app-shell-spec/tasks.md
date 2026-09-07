## 1. Confirm the app already behaves as the new scenarios describe

- [x] 1.1 Open `/` and `/trade` at 375 px and confirm both render their real screens (feed and trade), with yellow as the only strong accent and no placeholder text. Verify: report what each screen shows; no code change is expected â€” if one is needed, stop and raise it instead of editing the spec.

## 2. Sync and archive

- [x] 2.1 Merge the delta into `openspec/specs/app-shell/spec.md`: drop the two retired requirements, append their successors, keep every other requirement untouched. Verify: `openspec validate --specs` passes; the file has 11 requirements (9 untouched + 2 successors) and 25 scenarios (24 âˆ’ 2 retired + 3 new), with no `## ADDED/REMOVED` headers left in the main spec and no mention of "Placeholder home" or "Route not yet built".
