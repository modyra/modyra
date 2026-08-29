# The UI toolkit

Modyra ships rendered controls, and one definition of how they behave. This page is that definition
and the parts that apply to every renderer: the catalogue, theming, and accessibility.

The framework-specific catalogues are separate: [Angular](./ui-toolkit-angular.md) has its own
components and template syntax, Lit ships custom elements, and `@modyra/plain` renders without a
framework at all.

The engine stays UI-free. Every renderer is a layer on top of it — the core never depends on one,
and importing a single control does not pull in the whole catalogue.

## The catalogue: 17 widget kinds

Every renderer draws the same seventeen kinds, with the same parts, states and keyboard behaviour.

| Kind | Value type |
| :--- | :--- |
| `text`, `email`, `password` | `string` |
| `textarea` | `string` |
| `number` | `number \| null` |
| `slider` | `number` |
| `checkbox`, `toggle` | `boolean` |
| `radio`, `segmented` | `TValue \| null` |
| `select` | `TValue \| null` |
| `multiselect` | `TValue[]` |
| `datepicker` | `string` — ISO `yyyy-MM-dd`, a calendar date with no timezone |
| `daterange` | `MdyDateRange` |
| `timepicker` | `string` — `"HH:mm AM/PM"`, or `"HH:mm"` in 24-hour format |
| `colors` | `string` — hex |
| `file` | `File \| File[] \| null` |

What each kind is made of — its parts, how they relate, which classes a theme selects on, and how
each part looks in every state — is `@modyra/widgets`. That definition is public API:
[contract compatibility](../contract-compatibility.md) says what a change to it costs, and the
conformance CLI is what judges a renderer against it.

Three renderers are judged by that suite today: Angular, Lit and Plain.

An optional part also declares *when* it is on the page: a `MdyWidgetStructureNode` carries
`presentWhen`, drawn from the closed vocabulary `MDY_PART_PRESENCES`. The error container is the
case that forced the rule — it is reserved under any field that can fail a constraint, and its
contents appear when errors are visible, so the message does not move the field someone is reaching
for. An optional part with no condition declared is undecided, not always-on.

## Naming a control that has no visible label

A cell in a table, a control in a toolbar: the column header or the icon says what it is to someone
who can see it, and a screen reader meets the control on its own. `ariaLabel` names it:

```html
<!-- Angular -->
<mdy-control-text [field]="rows.f.lines.row(key).item" [ariaLabel]="'Item, row ' + key" />

<!-- Lit -->
<mdy-text-field aria-label="Item, row 12" .field=${cell}></mdy-text-field>
```

```ts
// Framework-free, and in a data-only document
renderField(container, { name: "item-12", kind: "text", ariaLabel: "Item, row 12" }, cell);
```

**An explicit `ariaLabel` wins over the visible label**, which is what makes a cell in a table
nameable: the column header says "Item" to someone who can see it, and the control still needs to
say *which* item on its own.

Use it only when the visible label genuinely does not identify the control. Giving a plainly
labelled field a different spoken name makes the two disagree — the user asks for what they can
read, and the machine is listening for something else.

Where nothing explicit is given, the control is still named, from the visible label's text. That is
deliberate rather than redundant: the label element also carries the required marker, so a name read
from its content would be "Item *" where the user reads and says "Item". The marker is decoration —
`aria-required` carries what it means.

## Rendering from a contract

The same catalogue renders from data rather than from markup. The document is a serializable
discriminated union — store it in a CMS or a form-builder backend — and its 17 field kinds are the
17 above. The JSON-safe validators (`required`, `email`, `min`/`max`, `minLength`/`maxLength`,
`pattern`) map to the same validator functions a typed form uses.

```ts
const fields = [
  { kind: "text", name: "fullName", label: "Full name", validators: { required: true, minLength: 2 } },
  { kind: "select", name: "topic", label: "Topic", options: [{ value: "sales", label: "Sales" }] },
  { kind: "slider", name: "score", label: "Score", min: 0, max: 10 },
];
```

Framework-free:

```ts
import { mountMdyForm } from "@modyra/plain";

mountMdyForm(container, fields, { onSubmit: (value) => save(value) });
```

Angular has an equivalent component — see [the Angular toolkit](./ui-toolkit-angular.md#rendering-from-a-contract).
`@modyra/react` builds the form state from the same document and leaves the markup to you.

Caveats when the JSON comes from the network:

- TypeScript types do not validate runtime data — run the payload through
  `parseDynamicFields()` first.
- Unknown `kind` values and malformed entries are dropped (dev-mode
  warning), so a partially-bad config still renders its valid fields.
- Labels and option texts are rendered as **text** (Angular interpolation),
  never as HTML — no injection through CMS content.
- Dynamic fields are stringly-typed by nature: the compile-time guarantees
  of `mdyForm()` do not apply to JSON-defined fields.

### Versioning and migrating stored configs

Store configs in the versioned envelope and migrate old versions in your
loader **before** parsing:

```ts
import {
  parseDynamicFields,
  type MdyDynamicField,
} from "@modyra/core";

function loadFields(raw: unknown): MdyDynamicField[] {
  // v0 legacy payloads used `type` instead of `kind` — migrate, then parse.
  const migrated = Array.isArray(raw)
    ? {
        version: 2 as const,
        fields: raw.map((f) => ({
          kind: (f as { type?: string }).type,
          ...(f as object),
        })),
      }
    : raw;
  return parseDynamicFields(migrated); // drops anything still invalid
}
```

`parseDynamicFields` accepts a bare array or a versioned envelope (v2, v3
or v4); any other declared version, v1 included, is rejected wholesale (fail
closed), while individually malformed fields are dropped item-by-item.

## A value the options do not contain

A select or a multiselect can be handed a value its option list does not name. It happens for
ordinary reasons: a record refers to something since deleted, an import carries a category that does
not exist yet, options arrive filtered from a service.

**The widget keeps it and shows it.** It renders as an option of its own, selected, labelled by the
value — and because it is on screen it can be replaced, or in a multiselect taken off. No renderer
decides this: the controllers in `@modyra/widgets` compute the list every renderer paints, which is
what stops three adapters from having three behaviours.

Three consequences worth stating:

- **The model is never rewritten to make the widget consistent.** A widget that erases what it
  cannot show destroys the one thing that would let a person fix it — see ADR 0029.
- **What refuses such a value is a rule, not the widget.** Pair the field with `oneOf()` (or
  `eachOneOf()` for a multiselect) if it must be invalid. A data-only document does this for you:
  the declared options are also a whitelist.
- **Nothing is added while the option list is empty.** Options that have not loaded are not a list
  that refuses the value, so a placeholder does not flash on every load.

A value that matches an option loosely — `"1"` against `1`, as one read from JSON does — is still
normalised to the option's own value. Values that are objects are matched by **identity**: two
different entities are never treated as the same choice.

### Giving it a readable name

There is no label hook for this, on purpose. An unrecognised value is named by itself, and an
application that wants something better supplies the option:

```ts
options = [
  { value: importedId, label: `To import: ${importedName}` },
  ...loadedOptions,
];
```

At that point the value is not unrecognised at all, and the same code works in every renderer and in
a data-only document — which a callback could not.

## Serializing a form value

```ts
import { mdyFormSerialize } from "@modyra/core/serialize";

const data = mdyFormSerialize(form.getValue());
```

Converts a form value into something `JSON.stringify` accepts. A `File` becomes a descriptive
string — `"[File: resume.pdf (12345 bytes)]"` — and file *contents* are never read or serialized.

## Theming — CSS token customization

The library uses a 3-tier CSS custom property system. Override tokens at any
scope — globally on `:root` or scoped to a container.

**Tier 1 — System tokens** (`--mdy-sys-*`): semantic design
values (color, shape, typography).

```css
:root {
  --mdy-sys-color-primary: #0071e3;
  --mdy-sys-color-on-primary: #ffffff;
  --mdy-sys-shape-corner-medium: 10px;
}
```

**Tier 2 — Component tokens** (`--mdy-comp-*`): fine-grained
per-component overrides.

```css
:root {
  --mdy-comp-text-input-height: 52px;
  --mdy-comp-select-option-padding: 12px 16px;
}
```

**Tier 3 — Bridge aliases** (`--mdy-primary`, `--mdy-on-surface`, …): short
variables used internally by all component CSS — the quickest path for a
global brand color change.

```css
:root {
  --mdy-primary: #0071e3;
  --mdy-on-surface: #1d1d1f;
}
```

Style entry points: `modyra.css` (everything), or one theme at a time over
`@modyra/styles/base.css` — `@modyra/styles/default.css`, `@modyra/styles/modern.css`,
`@modyra/styles/material.css`, `@modyra/styles/ios.css`, `@modyra/styles/ionic.css`,
`@modyra/styles/salience.css`.

`salience.css` is generated rather than written: the theme compiler takes a seed colour and solves
the light and dark token sets independently, so neither is a darkened copy of the other.

`modyra-base.css` is **required** by every theme except the all-in entry
points that import it themselves: the component CSS resolves every value
through a `--mdy-sys-*` / `--mdy-comp-*` token declared only there. A theme
loaded without it still applies its layout while every colour falls back to
its initial value — controls that are present, positioned, and invisible.

`modern.css` is Modyra's own theme: Satoshi typography and a compact, fully bordered control
(2.25rem) where Material 3 uses a 3.5rem filled one. It also styles a bare `input.mdy-checkbox`,
which the other themes do not: the catalogue's `.mdy-checkbox` styles a *label* wrapping a hidden
input, while the widget controllers put the class on the input itself.

### Writing a theme

Themes override tokens; they do not restate component CSS. Import the token
file and the default theme, then override inside `@layer mdy.themes`:

```css
@import './modyra-base.css';
@import './modyra.css';

@layer mdy.themes {
  :root {
    --mdy-comp-filled-text-field-container-height: 2.25rem;
    --mdy-comp-filled-text-field-container-shape: var(--mdy-sys-shape-corner-small);
  }
}
```

Never use `!important` in a theme. Layer order is **inverted** for important
declarations, so an `!important` inside `@layer mdy.components` beats
unlayered application CSS — a theme that uses it takes that property away
from every consumer permanently, with no way to win it back.

## Accessibility

The composite controls implement the matching WAI-ARIA patterns:

- Keyboard interaction on datepicker, select, multiselect, timepicker
  (arrow keys, Space, Enter, Escape, Home/End where applicable).
- Screen reader announcements via the `MdyA11yAnnouncer` live region in all
  overlays.
- Managed `aria-invalid`, `aria-required`, `aria-expanded`,
  `aria-activedescendant`, `aria-describedby`.
- Focus restoration when overlays close.

**What is checked, and where.** axe runs against the rendered controls
(`packages/angular/src/lib/renderers/a11y.spec.ts`) and against Studio
(`apps/studio/e2e/a11y.spec.ts`). Cross-browser behaviour runs on Chromium, Firefox and WebKit —
three renderers against three engines — in the browser suite on every CI run. The conformance CLI
checks anatomy, ARIA relations, states and keyboard behaviour for the three renderers.

Where the engines disagree, the difference is recorded rather than resolved; see
[known issues](../known-issues.md).
