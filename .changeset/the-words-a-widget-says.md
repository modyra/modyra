---
"@modyra/core": major
"@modyra/widgets": minor
"@modyra/angular": patch
---

The words a widget says belong to the widget contract

`@modyra/core/localization` is removed. The forty-one UI strings and their five
locales move to `@modyra/widgets`: a search box's placeholder and a clock's
confirm button are what a widget *says*, and the engine has no opinion about
either.

The subpath goes with them because nothing else was left in it — `buildDateLocale`
had already moved to `@modyra/core/datetime`, where the calendar that reads a
locale lives.

```diff
-import { MDY_I18N_MESSAGES_IT } from "@modyra/core/localization";
+import { MDY_I18N_MESSAGES_IT } from "@modyra/widgets";
```

What this makes possible and does not yet do: the tables had exactly one consumer
while they sat in the engine. The framework-free and Lit renderers hardcode
English, so the same button reads "Open the calendar" in one, "Open date picker"
in another and "Toggle calendar" in the table neither of them opened. They can
reach it now; they still do not.
