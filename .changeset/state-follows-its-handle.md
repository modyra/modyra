---
"@modyra/widgets": patch
"@modyra/angular": patch
---

Two controllers stopped keeping a copy of their own value

`createOptionFieldController` seeded `selectedKey` from the handle and wrote it
beside every commit; `createColorsFieldController` did the same with `text`.
Neither carried information the value did not — selecting always writes both —
but both could disagree with it: a value written from anywhere else (a draft
restored, a server response, `patch()`) left the state reporting the live value
beside a stale copy, and the option field decides which radio is checked from the
copy. The key is derived now, and the colour's box shows the value except while a
keystroke is on its way to being one.

`packages/widgets/test/state-follows-its-handle.spec.mjs` is the property that
found them: build a controller, write the handle from outside, and check that
every part of the state derived from the value followed. It runs over seven kinds
and the eighth arrives already covered.

The Angular calendars share `calendarViewState`. Both are public and mountable
without a form, so both need the signals that answer when no controller does —
and written in each, the two were identical, which the similarity gate said the
moment the single calendar adopted its controller. What differs between a date
picker and a range picker is what a *pick* means, never which month is on screen.
