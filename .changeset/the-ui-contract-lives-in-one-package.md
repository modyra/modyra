---
"@modyra/core": major
"@modyra/widgets": minor
"@modyra/lit": patch
---

The UI contract lives in one package

`@modyra/core/ui` is removed. The icon geometry, the keyboard policy a listbox
and a calendar answer to, and the option filter move to `@modyra/widgets`, which
is what ADR 0006 said they were all along.

The reason is worse than misplacement: **`@modyra/widgets` imported them from the
engine, in five files.** The package that is the UI contract was reaching
sideways for its own material, and the three renderers each imported the same
door directly — so a widget's keyboard had two plausible homes and every consumer
picked one.

```diff
-import { calendarKeyboardTarget, filterOptionsByQuery, MDY_ICONS } from "@modyra/core/ui";
+import { calendarKeyboardTarget, filterOptionsByQuery, MDY_ICONS } from "@modyra/widgets";
```

`listboxNavigationIndex` is gone with it. It was `listboxNextIndex` re-exported
under a second name, so one function answered to two depending on which renderer
was asking; the name it has is `listboxNextIndex`.

Recorded as ADR 0036, including the check it does not have: nothing forbids a new
UI module appearing in the engine tomorrow.
