# UI toolkit — renderers, dynamic forms, theming

The renderer catalog is an **ecosystem layer** on top of the Signals core:
the core never depends on it, and importing one control does not pull in the
whole catalog (standalone components, standard tree shaking).

## Component catalog

| Selector                  | Component                     | Value type               |
| :------------------------ | :---------------------------- | :----------------------- |
| `mdy-control-text`        | `MdyTextComponent`            | `string`                 |
| `mdy-control-textarea`    | `MdyTextareaComponent`        | `string`                 |
| `mdy-control-number`      | `MdyNumberComponent`          | `number \| null`         |
| `mdy-control-checkbox`    | `MdyCheckboxComponent`        | `boolean`                |
| `mdy-control-toggle`      | `MdyToggleComponent`          | `boolean`                |
| `mdy-control-radio`       | `MdyRadioGroupComponent`      | `TValue \| null`         |
| `mdy-control-segmented`   | `MdySegmentedButtonComponent` | `TValue \| null`         |
| `mdy-control-slider`      | `MdySliderComponent`          | `number`                 |
| `mdy-control-select`      | `MdySelectComponent`          | `TValue \| null`         |
| `mdy-control-multiselect` | `MdyMultiselectComponent`     | `TValue[]`               |
| `mdy-control-datepicker`  | `MdyDatePickerComponent`      | `string` (ISO `yyyy-MM-dd`, a calendar date — no timezone) |
| `mdy-control-daterange`   | `MdyDateRangePickerComponent` | `MdyDateRange`           |
| `mdy-control-timepicker`  | `MdyTimepickerComponent`      | `string` (`"HH:mm AM/PM"`, or `"HH:mm"` 24h with `format="24h"`) |
| `mdy-control-colors`      | `MdyColorsComponent`          | `string` (hex)           |
| `mdy-control-file`        | `MdyFileComponent`            | `File \| File[] \| null` |

## UI enhancements

### Prefixes & suffixes

```html
<mdy-control-text name="price" label="Price">
  <span mdyPrefix>$</span>
  <span mdySuffix>.00</span>
</mdy-control-text>
```

### Floating labels & supporting text

```html
<mdy-form [mdyFloatingLabels]="true" [mdyFloatingLabelsDensity]="-2">
  <mdy-control-text name="email" label="Email">
    <small mdySupportingText>We'll never share your email.</small>
  </mdy-control-text>
</mdy-form>
```

### Inline errors

```html
<mdy-control-text name="password" label="Password" mdyInlineErrors />
```

## Enterprise select — server-side search & tagging

```html
<mdy-control-select
  name="city"
  searchable
  allowCreate
  [mdyLoadOptions]="searchCities"
  [mdyLoadOptionsDebounce]="300"
  (optionCreated)="addCity($event)"
/>
```

`[mdyLoadOptions]` calls `(query) => Promise<MdySelectOption[]>` on every
debounced query change (including the initial empty query) with the loading
spinner driven for the whole window and last-wins semantics on out-of-order
responses — works on select and multiselect. `allowCreate` adds a
"Create «query»" row when no option label matches (keyboard: Enter with no
active option): pick it and `optionCreated` fires with the query.

### Conditional options

```html
<mdy-control-select name="country" [options]="countries" />
<mdy-control-select
  name="province"
  [mdyDependsOn]="'country'"
  [mdyOptionsMap]="provincesByCountry"
/>
```

## Dynamic forms — render from JSON config

```ts
readonly fields: MdyDynamicField[] = [
  { kind: "text", name: "fullName", label: "Full name", validators: { required: true, minLength: 2 } },
  { kind: "select", name: "topic", label: "Topic", options: [{ value: "sales", label: "Sales" }] },
  { kind: "slider", name: "score", label: "Score", min: 0, max: 10 },
];
```

```html
<mdy-dynamic-form [fields]="fields" (submitted)="save($event)">
  <button type="submit">Send</button>
</mdy-dynamic-form>
```

The config is a serializable discriminated union (store it in a CMS or
form-builder backend): 14 field kinds map to the renderer catalog and the
JSON-safe validator set (`required`, `email`, `min/max`,
`minLength/maxLength`, `pattern`) maps to the pure validator functions.
Projected content (like the submit button) lands inside the generated
`<mdy-form>`; the inner form is exposed via the `form` view child.

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
import { parseDynamicFields, MdyDynamicField } from "@modyra/angular";

function loadFields(raw: unknown): MdyDynamicField[] {
  // v0 legacy payloads used `type` instead of `kind` — migrate, then parse.
  const migrated =
    Array.isArray(raw)
      ? { version: 1 as const, fields: raw.map((f) => ({ kind: (f as { type?: string }).type, ...(f as object) })) }
      : raw;
  return parseDynamicFields(migrated); // drops anything still invalid
}
```

`parseDynamicFields` accepts a bare array or a `{ version: 1, fields }`
envelope; unknown envelope versions are rejected wholesale (fail closed),
while individually malformed fields are dropped item-by-item.

## Form serialization

```ts
const data = mdyFormSerialize(adapter.getValue());
```

Converts a form value into a JSON-serializable object; `File` objects become
descriptive strings (`"[File: resume.pdf (12345 bytes)]"`) — file *contents*
are never read or serialized.

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

Style entry points: `modyra.css` (all-in), or
`modyra-material.css`, `modyra-ios.css`,
`modyra-ionic.css`, `modyra-base.css` (bare layout).

## Accessibility

The composite controls implement the corresponding WAI-ARIA patterns:

- Keyboard interaction on datepicker, select, multiselect, timepicker
  (arrow keys, Space, Enter, Escape, Home/End where applicable).
- Screen reader announcements via the `MdyA11yAnnouncer` live region in all
  overlays.
- Managed `aria-invalid`, `aria-required`, `aria-expanded`,
  `aria-activedescendant`, `aria-describedby`.
- Focus restoration when overlays close.

Automated accessibility tests (axe) and cross-browser component tests are
**not yet part of CI** — treat per-widget conformance as "implemented and
unit-tested where the test runner allows", not as externally verified. This
is tracked in the roadmap.
