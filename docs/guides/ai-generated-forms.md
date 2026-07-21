# AI-generated forms

LLMs are good at producing structured JSON; Modyra dynamic forms render a
JSON-safe field contract. Put the two together and you get AI-generated
forms **without executing or injecting a single string the model wrote** —
the model only ever produces data, and `parseDynamicFields()` decides what
is allowed to exist.

This guide packages the pipeline: the JSON contract, a system prompt that
constrains the model to it, and the render path. The rendering half is
covered in [UI toolkit — dynamic forms](ui-toolkit.md).

## The safe pipeline

```
LLM output (untrusted text)
  → JSON.parse                      (plain data — never eval, never HTML)
  → parseDynamicFields()            (runtime validation, drops bad entries)
  → <mdy-dynamic-form [fields]>     (Angular text interpolation, auto-escaped)
  → form.submit()                   (typed value, your handler)
```

Treat model output with the same trust level as a `?q=` URL parameter:

- **Never** render it as HTML. Modyra never does — labels, options and
  error messages go through Angular text interpolation, never `innerHTML`
  (see [SECURITY.md](../../SECURITY.md)). Do not bypass this with
  `[innerHTML]` bindings of your own.
- **Never** skip `parseDynamicFields()`. TypeScript types do not check
  runtime JSON; the parser does. Unknown `kind`s, reserved names
  (`__proto__`, `constructor`, …), names containing `.` (path separator),
  duplicates, missing `options`, inverted `min`/`max` ranges and
  over-long regex sources are **dropped** with a dev-mode warning — a
  partially-hallucinated config still renders its valid fields.
- Validator `pattern` sources are capped (256 chars) and compiled inside
  `try/catch`: an invalid regex is skipped, not thrown.
- **Option values are whitelisted automatically.** `select`/`radio`/
  `segmented`/`multiselect` fields declare their options in the config —
  the engine constrains the field value to them (`oneOf`/`eachOneOf` via
  `buildDynamicFieldValidators`). A hallucinated `initialValue` outside
  the option list, or a scripted `set()` with one, is simply invalid.
- The model cannot reach code: there is no `kind` that runs functions,
  loads URLs or fetches options by itself.

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
prompts reduce waste, `parseDynamicFields()` guarantees safety.

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

- **Angular renders the catalog** (`<mdy-dynamic-form>`). On React/Vue/Lit
  the contract and `parseDynamicFields()` work the same — map each
  `MdyDynamicField.kind` to your own controls over the headless handles
  (see [Usage modes](usage-modes.md)).
- CMS/storage use case: same contract, same parser — see
  [UI toolkit — dynamic forms](ui-toolkit.md) for the versioning notes.
- Keep the schema of *your* domain out of the prompt when possible: a
  smaller, fixed contract is what makes the output predictable enough to
  validate.
