---
"@modyra/styles": patch
---

A prefix and a suffix pad along the writing direction.

The same defect as `.mdy-input-wrapper__inliner`, one level out and missed by the sweep that fixed
it. `.mdy-input-prefix` and `.mdy-input-suffix` set `padding-left: 0.75rem; padding-right: 0.25rem`
and its mirror — roomy on the outer edge, tight against the input, which is right, written
physically, which is not. Under `dir="rtl"` the 8px stayed where it was, so the suffix sat 8px inside
where it belonged in all four packaged themes.

The two sibling rules that tighten the input beside an affix are logical now for a subtler reason:
DOM order does not change under `dir="rtl"`, so `.mdy-input-prefix+input` still matches — and a
physical `padding-left` there tightened the side the *suffix* had moved to.

Measured, not eyeballed. `e2e/rtl.spec.ts` read the suffix at 222px from the inline start in LTR and
214px in RTL; all sixteen families now mirror on Chromium, Firefox and WebKit.

This had been red since before the engines were added, on Chromium too. `npm test` does not run
Playwright, so nothing routine was saying so — recorded as finding **L** in `docs/contract-gaps.md`.
