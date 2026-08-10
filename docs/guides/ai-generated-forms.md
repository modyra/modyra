# Forms as data

A Modyra form can be a JSON document rather than code — produced by a service, a CMS, a visual
editor, or a language model. Whatever produced it, treat it as untrusted input.

The supported path is:

```text
external text
  -> JSON.parse
  -> parseDynamicForm() or parseDynamicFields()
  -> framework renderer or headless bindings
  -> server-side validation on submission
```

The parser accepts a bounded set of field kinds, validator options, layout nodes and rule operators. It rejects or reports unsupported structures before they reach a renderer. This reduces the attack surface but does not replace application-level authorization, server validation or safe DOM rendering.

## Trust boundaries

- Parse runtime input before constructing a form. TypeScript types do not validate JSON.
- Do not pass labels, messages or option text to HTML sinks. Render them as text.
- Validate submitted values again on the server.
- Apply application-specific limits for payload size, nesting and storage.
- Use strict mode before publishing or registering a stored contract. Lenient mode is useful for editor previews where partial diagnostics are expected.
- Treat prompts as generation guidance, not as an enforcement mechanism. The parser and server schema remain authoritative.

## The JSON contract

Either a bare array of fields, or a versioned envelope
(`{ "version": 1, "fields": [...] }` — unknown versions are rejected).

Common field properties:

| Property | Type | Notes |
| :-- | :-- | :-- |
| `name` | string | required, unique, no `.`, not `__proto__`/`prototype`/`constructor` |
| `kind` | string | required — one of the kinds below |
| `label` | string | optional |
| `placeholder` | string | optional |
| `initialValue` | any | optional |
| `validators` | object | optional — see below |

Kinds (`MDY_DYNAMIC_FIELD_KINDS` is the source of truth):

| `kind` | Extra properties | Value type |
| :-- | :-- | :-- |
| `text`, `textarea`, `email`, `password` | — | string |
| `number`, `slider` | `min`, `max`, `step` (> 0) | number |
| `checkbox`, `toggle` | — | boolean |
| `select`, `radio`, `multiselect`, `segmented` | `options` (**required**: `{ value, label, disabled? }[]`) | value / value[] |
| `datepicker`, `timepicker` | — | date/time string |

`validators` (all optional): `required` (boolean), `email` (boolean),
`min` / `max` (finite numbers), `minLength` / `maxLength` (finite
numbers, `minLength ≤ maxLength`), `pattern` (RegExp **source** string,
≤ 256 chars).

## System prompt template

Copy-adapt this to constrain the model to the contract:

```text
You generate form configurations as JSON for a strict renderer.

OUTPUT RULES
- Respond with a single JSON object, no markdown fences, no commentary:
  { "version": 1, "fields": [ ... ] }
- Every field: { "name", "kind", "label", "placeholder"?, "initialValue"?,
  "validators"? }.
- "name" must be a unique camelCase identifier. No dots, never
  "__proto__", "prototype" or "constructor".
- "kind" MUST be one of: text, textarea, email, password, number, slider,
  checkbox, toggle, select, radio, multiselect, segmented, datepicker,
  timepicker. Do not invent other kinds.
- Kinds select/radio/multiselect/segmented REQUIRE "options":
  [{ "value": <string|number|boolean>, "label": <string> }, ...].
- Kinds number/slider accept "min", "max", "step" (numbers, min ≤ max).
- "validators" may only contain: required (boolean), email (boolean),
  min, max, minLength, maxLength (numbers), pattern (regex source string
  without slashes, e.g. "^[A-Z]{2}\\d{4}$").
- Anything outside this contract is discarded by the renderer, so stay
  inside it. Ask for clarification instead of inventing kinds.

USER REQUEST: <the user's form description goes here>
```

Even with a perfect prompt, the parser stays the enforcement layer —
prompts reduce waste, `parseDynamicFields()` enforces the supported contract.

## End-to-end example

A (simulated) model response — deliberately containing four mistakes:

```ts
import { parseDynamicFields } from "@modyra/core";

const llmResponse = JSON.stringify({
  version: 1,
  fields: [
    { kind: "text", name: "fullName", label: "Full name",
      validators: { required: true, minLength: 2 } },
    { kind: "email", name: "email", label: "Work email",
      validators: { required: true, email: true } },
    { kind: "select", name: "plan", label: "Plan",
      options: [
        { value: "free", label: "Free" },
        { value: "pro", label: "Pro" },
      ],
      validators: { required: true } },
    { kind: "slider", name: "satisfaction", label: "Satisfaction",
      min: 0, max: 10, initialValue: 5 },
    { kind: "datepicker", name: "startDate", label: "Start date" },

    // — the model's mistakes, all dropped with dev-mode warnings:
    { kind: "richtext", name: "bio", label: "Bio" },        // unknown kind
    { kind: "select", name: "country", label: "Country" },  // missing options
    { kind: "text", name: "__proto__", label: "x" },        // reserved name
    { kind: "text", name: "fullName", label: "dup" },       // duplicate name
  ],
});

// 5 fields kept, 4 dropped — the form still renders.
const fields = parseDynamicFields(JSON.parse(llmResponse));
```

Rendering it needs no framework:

```ts
import { mountMdyForm } from "@modyra/plain";

const mounted = mountMdyForm(document.getElementById("host"), fields, {
  onSubmit: (value) => console.log(value), // partial: a disabled field is not submitted
});
// mounted.form is the running @modyra/core form; mounted.dispose() unmounts everything.
```

and each binding has its own way of drawing the same field list — in Angular:

```html
<mdy-dynamic-form [fields]="fields" (submitted)="onSubmitted($event)">
  <button type="submit">Send</button>
</mdy-dynamic-form>
```

```ts
onSubmitted(event: { value: Record<string, unknown> }): void {
  // {
  //   fullName: "Ada Lovelace",
  //   email: "ada@example.com",
  //   plan: "pro",
  //   satisfaction: 7,
  //   startDate: "2026-08-01",
  // }
  console.log(event.value);
}
```

## Notes

- **The parser is the contract; drawing it is the renderer's part.** Every
  binding reads the same `MdyDynamicField[]` and wires the same validators
  through `buildDynamicFieldValidators()` — including the automatic
  `oneOf`/`eachOneOf` anti-tampering whitelist for option-based kinds — so
  value, validation and error semantics do not vary by framework.
- **What differs is how much drawing a binding does for you.** Some ship a
  component that renders the catalogue from the field list
  (`<mdy-dynamic-form>`, `mountMdyForm`); others hand you the headless
  handles and let you render your own controls (`useMdyDynamicForm` in React
  and Preact, paired with `useMdyField` and its siblings). Mapping each
  `MdyDynamicField.kind` to your own controls is always available.
- **`layout` is applied by `@modyra/plain` and `@modyra/angular`.** No
  renderer applies `rules` yet: the parser validates them and the contract
  carries them, but visibility and enabled-state are still the host's to
  apply.
- CMS/storage use case: same contract, same parser — see
  [the UI toolkit](ui-toolkit.md#rendering-from-a-contract) for the versioning notes.
- Keep the schema of *your* domain out of the prompt when possible: a
  smaller, fixed contract is what makes the output predictable enough to
  validate.

### Contract v2: layout and declarative rules

Version 2 preserves the v1 field contract and adds optional `layout` and
`rules`. Both remain data-only: rules use a fixed operator allowlist and may
only reference declared field names. There are no expressions, callbacks,
HTML fragments, or arbitrary URLs.

A layout node is a `section` (with `children`) or a `columns` row (with
`columns`). A slot holds either a field name or another layout node, so a
column row can sit inside a section. Two constraints the parser enforces:
nesting is capped at `MDY_LAYOUT_MAX_DEPTH` (6), and **a field may be placed
only once** — the same field in two slots would render twice and bind one
value to both controls.

```json
{
  "version": 2,
  "id": "business-signup",
  "fields": [
    {
      "name": "customerType",
      "kind": "select",
      "options": [
        { "value": "private", "label": "Private" },
        { "value": "business", "label": "Business" }
      ]
    },
    { "name": "vatNumber", "kind": "text", "label": "VAT number" }
  ],
  "layout": [
    {
      "kind": "section",
      "id": "identity",
      "children": [
        "customerType",
        { "kind": "columns", "id": "vat", "columns": [["vatNumber"], []] }
      ]
    }
  ],
  "rules": [
    {
      "effect": "visible",
      "target": "vatNumber",
      "when": {
        "field": "customerType",
        "operator": "equals",
        "value": "business"
      }
    }
  ]
}
```

### Contract v3: a slot that moves with the screen

Version 3 adds one thing to v2 and changes nothing else: **where a single child sits, and whether it
shows, per screen size.** A v2 document is a v3 document with the version number raised.

In v2 a layout child is a field name. In v3 it can also be a slot — the same field, plus placement:

```json
{
  "version": 3,
  "layout": [
    {
      "kind": "columns",
      "id": "address",
      "at": { "base": 1, "md": 2 },
      "columns": [
        [{ "ref": "city", "at": { "md": { "column": 1 } } }],
        [{ "ref": "region", "at": { "base": { "hidden": true }, "md": { "column": 2 } } }]
      ]
    }
  ]
}
```

The breakpoints are `base`, `sm`, `md` and `lg`. A section can carry the same `at`, so a group is
layout-able for a screen size like anything else.

The row's track count stays on the row (`at` on the `columns` node), where v2 put it. There is one
spelling for it, because a second way to say the same thing leaves every reader deciding which wins.

Use `parseDynamicForm(input, { mode: "lenient" })` for AI previews: valid
fields survive and diagnostics explain rejected fields, layout nodes, and
rules. Use `mode: "strict"` before publishing a stored contract or accepting
it into an API registry: any diagnostic makes `ok` false and returns no
renderable fields. `parseDynamicFields()` remains backward compatible and
accepts v1, v2, v3 and the legacy bare field array.

The machine-readable schema is `spec/dynamic-form-v3.schema.json`, with
`spec/dynamic-form-v2.schema.json` for documents that stay on v2. Point a
document's `$schema` at one and an editor underlines a malformed field as it
is written, with no extension installed. Rust services can use the matching
`sdk/rust/modyra-contract` crate; TypeScript and Rust run against the same
conformance fixtures.

The schema checks shape, and that is all it can check. A cross-reference is
invisible to JSON Schema: a layout slot naming a field that does not exist, a
second field with a name already taken, a validation reading a path nothing
declares — every one of those passes the schema and fails
`parseDynamicForm`. Treat a green schema as "well-formed", never as "valid",
and keep the parser in the path. `npm run test:contract-schema` holds the
schema to the kinds and slots the parser accepts, so the two stay describable
as one document.

For contracts written as TypeScript literals rather than JSON,
`@modyra/eslint-plugin` reports the same parser diagnostics in the editor.

### Rust business object to Angular renderer

The Rust workspace includes a runnable Axum example that demonstrates the
same contract without an LLM. Rust converts a checkout business configuration
(countries, defaults, quantity constraints) into Contract v2 and exposes it at
`GET /v1/forms/checkout`. The Angular demo fetches the response as `unknown`,
runs `parseDynamicForm(input, { mode: "strict" })`, and passes only accepted
fields to `<mdy-dynamic-form>`.

```text
Rust CheckoutConfiguration
  -> DynamicFormV2
  -> GET /v1/forms/checkout
  -> Angular HttpClient<unknown>
  -> parseDynamicForm(..., { mode: "strict" })
  -> <mdy-dynamic-form [fields]="parsed.fields">
```

Run the Rust server and Angular demo in separate terminals:

```bash
cargo run --manifest-path sdk/rust/Cargo.toml \
  -p modyra-axum-form-server-example
npm run demo:angular
```

The demo also sends the completed value to Rust at
`POST /v1/forms/checkout/submissions` and displays either the generated
submission ID or normalized field errors. CORS is restricted to the Angular
dev origin (`http://localhost:4200`).

The cross-language checkout now uses recursive Contract v2 nodes. Rust emits
a `shipping` group and an `items` array; strict parsing expands the accepted
initial structure to `shipping.city`, `shipping.zip`, `items.0.sku`, and
`items.0.qty` for the current Angular renderer.

#### Recursive `group` and `array` nodes

Contract v2 can use a recursive root `schema` instead of the legacy flat
`fields` list. A group maps named children to dotted paths; an array repeats
a field/group item descriptor and expands its initial rows to indexed paths.
The parser enforces a maximum depth of 8, 500 total nodes, and 100 initial
array rows before anything reaches the renderer.

```json
{
  "version": 2,
  "schema": {
    "node": "group",
    "children": {
      "shipping": {
        "node": "group",
        "children": {
          "city": { "node": "field", "field": { "kind": "text" } },
          "zip": { "node": "field", "field": { "kind": "text" } }
        }
      },
      "items": {
        "node": "array",
        "initialValue": [{ "sku": "TSHIRT-BLK-M", "qty": 2 }],
        "item": {
          "node": "group",
          "children": {
            "sku": { "node": "field", "field": { "kind": "text" } },
            "qty": { "node": "field", "field": { "kind": "number", "min": 1 } }
          }
        }
      }
    }
  }
}
```

For the current Angular renderer, recursive nodes compile to validated dotted and
indexed field paths such as `shipping.city`, `items.0.sku`, and
`items.0.qty`. This preserves nested submission semantics and initial
array rows. Interactive row insertion/removal remains owned by the typed
`array()` renderer path; Contract v2 currently renders the rows declared in
`initialValue`.
