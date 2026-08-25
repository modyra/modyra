---
"@modyra/widgets": patch
---

The browsers this library works in are now declared, and enforced

There was no `browserslist`, no CSS lint and no sentence anywhere saying which browsers this library
supports. It arrived at its present shape one rule at a time — 85 uses of `:has()`, 144 of
`color-mix()` — and the first rule newer than somebody's browser would have broken their page with
nothing here to say so.

The floor is **Baseline widely available**. Everything used below it is declared in
`packages/widgets/contract-baseline/platform-floor.json` with what is lost without it, and with the
guard or the check that holds its fallback. Three features are below the line today — the Popover
API, `backdrop-filter` and relative colour syntax — all enhancements, all degrading rather than
breaking, and that file says exactly how.

`npm run test:platform-floor` fails on a breach and runs in the contract gates. Nothing about the
published API changes. See ADR 0151.
