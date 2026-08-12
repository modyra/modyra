---
"@modyra/core": major
"@modyra/widgets": major
---

One door per name, and nothing published before it is used

**The surface was not what it was measured to be.** The audit that snapshots the public type surface
read every emitted `.d.ts` in `dist`, so it counted 623 shapes when a consumer could reach 26
subpaths — `FieldRecord`, `AsyncValidatorEntry`, `define` and `MdyWidgetShape` were all reported as
public and none of them is on an entry. It now resolves the names through the TypeScript checker
starting from the `exports` map, which is the only definition of the surface that a consumer sees.
The first honest number is 581 shapes.

**A name is reachable from one subpath.** 82 of `@modyra/core`'s 155 symbols could be imported by
two paths, and the adapters had divided themselves between the aliases: `calendarKeyboardTarget` from
`/ui` and `/keyboard`, `CalendarDate` from `/datetime` and `/date-utils`. Every duplicate was an
aggregate published beside the granular files it re-exported, and the aggregate wins because it names
a domain rather than a file. `scripts/audit-public-doors.mjs` now fails on a name with two doors.

Removed from `@modyra/core`, each redundant with the entry or with the aggregate that keeps it:

| removed | import from |
|---|---|
| `@modyra/core/form` | `@modyra/core` |
| `@modyra/core/validation` | `@modyra/core` |
| `@modyra/core/dynamic-config` | `@modyra/core` |
| `@modyra/core/date-utils` | `@modyra/core/datetime` |
| `@modyra/core/time-utils` | `@modyra/core/datetime` |
| `@modyra/core/date-locale` | `@modyra/core/datetime` |
| `@modyra/core/icons` | `@modyra/core/ui` |
| `@modyra/core/keyboard` | `@modyra/core/ui` |
| `@modyra/core/options-utils` | `@modyra/core/ui` |
| `@modyra/core/i18n` | `@modyra/core/localization` |

Removed from `@modyra/widgets`, all three wholly contained in the entry:

| removed | import from |
|---|---|
| `@modyra/widgets/ids` | `@modyra/widgets` |
| `@modyra/widgets/runtime` | `@modyra/widgets` |
| `@modyra/widgets/commands` | `@modyra/widgets` |

`@modyra/widgets/testing` no longer re-exports `portalRootFor`; the runtime needs it and it has been
on the package entry since it moved there.

**Two audiences, two doors.** The entry offers what a renderer draws with — part ids, root classes,
projections, controllers, the interactivity predicates. The tables a theme or a conformance checker
reads move to `@modyra/widgets/vocabulary`: `MDY_WIDGET_STATES`, `MDY_WIDGET_STATE_SUPPORT`,
`MDY_WIDGET_STATE_CONTRACTS`, `MDY_CANONICAL_UI_CLASSES`, `MDY_CSS_PROPERTY_NAMES`,
`MDY_SHARED_UI_CLASSES`, `MDY_STATE_MODIFIERS`, `MDY_LABELABLE_TAGS`, `MDY_FIELD_SHELL_STRUCTURE`,
`widgetSupportsState`, `widgetStateMatrixSize`. The types a presenter implements stay on the entry,
because that is where a renderer reaches for them. The unused `@modyra/widgets/contract` subpath,
which published those same types a second time, is gone.

**Nothing is published before an implementation uses it.** Seven names were added while the
controllers behind them were being written and no renderer consumes them yet, so they leave the entry
and return with the renderer that takes them up: `createColorsFieldController`,
`createFileFieldController`, `createSelectFieldController`, `createPointerDrag`, `dragPointOf`,
`daterangeFieldPartIds`, `daterangeFieldRootClasses` — with `MdyDragPoint`, `MdyPointerDrag` and
`MdyPointerDragOptions`, which described the last two. All remain in the package; the modules that
declare them are unchanged.
