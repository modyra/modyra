# Compared with JSON Forms

[JSON Forms](https://jsonforms.io/) is the closest neighbour to Modyra's contract mode: it also
renders a form from data rather than from component code, and it also ships bindings for more than
one framework. This page is here to help you decide, and it says where JSON Forms is the better
answer.

Snapshot date: 2026-08-22. Both projects move; re-read the sources before quoting this page.

## The contracts differ in what they can say

JSON Forms speaks **JSON Schema**: the form is a data schema plus a UI schema, and validation is
what AJV can express over that schema. Modyra's Dynamic Form Contract is a smaller, form-shaped
vocabulary: field kinds, validator options, layout nodes and rule operators — bounded on purpose, so
that a document from an untrusted source can be parsed strictly and rejected or reported before
anything renders.

| Aspect | JSON Forms | Modyra |
| :--- | :--- | :--- |
| Contract format | JSON Schema + UI schema | Dynamic Form Contract — fields, layout, rules, validators as form-shaped data |
| Validation | AJV over the data schema; custom rules need code | Validator options in the contract; async, cross-field and server validation are engine features, not document extensions |
| Untrusted documents | The document is a schema — the power and the exposure of JSON Schema | Strict mode refuses a document with any diagnostic; lenient mode reports and keeps what parsed |
| Frameworks | React, Angular, Vue bindings | Angular, Lit and framework-free renderers; React, Vue, Solid, Preact, Svelte headless adapters |
| Lifecycle (drafts, undo, async cancellation) | Not part of the model | In the engine, so contract-driven forms get them too |
| Producers | Anything that emits JSON Schema | TypeScript, the [Rust](https://github.com/modyra/modyra/tree/main/sdk/rust) and [Java](https://github.com/modyra/modyra/tree/main/sdk/java) SDKs, and Studio — which can also export ordinary source instead of the contract |
| Maturity | Long production history, EclipseSource stewardship | Younger; core and widgets versioned under a [compatibility policy](../contract-compatibility.md), adapters below 1.0 |

## Choose JSON Forms if…

- Your source of truth already is JSON Schema — existing schemas, an OpenAPI document, a code
  generator that emits them.
- You want AJV's validation semantics and its ecosystem of formats and keywords.
- React, Angular or Vue covers your surfaces.

## Choose Modyra if…

- The form must survive being produced by something you do not control — a service, a CMS, a model —
  and be parsed strictly before it renders.
- You need the lifecycle with the form, not beside it: drafts, undo, cancellable async validation.
- The same form has to reach frameworks outside React/Angular/Vue, or no framework at all.

## See also

- [Forms as data](./ai-generated-forms.md) — the contract and its trust boundary in full
- [Bundle and feature comparison](./comparison-form-libraries.md) — the dated, measured table
- [Migration guide](./migration.md)
