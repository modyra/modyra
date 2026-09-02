# Quickstart

The shortest path from install to a running form. It uses `@modyra/plain`, the framework-free
renderer, because it shows the model with nothing in front of it; every framework adapter offers the
same modes with its own syntax — see [usage modes](./usage-modes.md).

## Install

```bash
npm install @modyra/core @modyra/plain
```

`@modyra/core` is the engine. `@modyra/plain` renders a form into a container element with no
framework runtime. Add `@modyra/styles` if you want a ready-made theme: without one the controls are
structurally correct but unstyled. For React, Vue, Angular, Lit, Solid, Preact or Svelte, install
the matching adapter instead — the [package table](../../README.md#packages) in the repository
README links each one.

## A typed form

The schema is TypeScript, so a typo in a field path is a compile error rather than a silently new
field.

```ts
import { createForm, email, field, min, required } from "@modyra/core";

const form = createForm({
  name: field("", [required()]),
  age: field<number | null>(null, [min(18)]),
  contact: field("", [required(), email()]),
});

form.f.name.set("Ada");
form.f.name.errors();   // []
form.f.age.required();  // false
```

This form runs anywhere — a browser, a worker, a Node test — because nothing in it references a
rendering layer. Validation, drafts, undo and submission all live here, before any UI exists.
[Typed forms](./typed-forms.md) covers arrays, keyed collections, async validation and history.

## A form from data

When the form is a JSON document — from a server, a CMS, or Studio — mount it in one call.
TypeScript types do not validate runtime data, so the document is checked before anything is drawn:

```ts
import { mountDynamicForm } from "@modyra/plain";

const { form, dispose } = mountDynamicForm(document.querySelector("#form"), await response.json(), {
  onSubmit: (value) => api.save(value),
});
```

The document is parsed strictly and refused if anything is wrong, and everything it declares —
fields, layout, rules, collections — is applied. Threading those through by hand is the older shape
and the reason this call exists: a document that declared a layout and was mounted without it drew a
form nobody asked for, and nothing said so.

Reach for the longer form when you want the diagnostics rather than the exception, or when you want
lenient mode — an editor preview keeps what parsed and reports the rest:

```ts
import { parseDynamicForm } from "@modyra/core";
import { mountMdyForm } from "@modyra/plain";

const result = parseDynamicForm(await response.json(), { mode: "lenient" });
report(result.diagnostics);

const { form, dispose } = mountMdyForm(document.querySelector("#form"), result.fields, {
  layout: result.layout,
  rules: result.rules,
  onSubmit: (value) => api.save(value),
});
```

Strict mode returns nothing at all when any diagnostic exists — a partly valid document is never
accepted. Lenient mode keeps what parsed and reports the rest, which is what an editor preview
wants. `mountMdyForm` returns the real `@modyra/core` form, so everything the typed mode can do is
available here too; call `dispose()` to unmount every field and deactivate the form.

## Where next

- [Usage modes](./usage-modes.md) — typed, contract-driven and headless, and how they mix
- [The feature tour](../feature-tour.md) — every feature with a runnable example and a screenshot
- [The example for your framework](../examples/checkout-scenario.md) — the same checkout form in
  every adapter
- [Forms as data](./ai-generated-forms.md) — the Dynamic Form Contract and its trust boundary
- [Studio](../studio/overview.md) — build the document visually, export the contract or the code

## What this page skips

Rendering a typed form is each adapter's job — pick yours from the examples above. Server
validation, theming and internationalization have their own guides:
[server validation](./server-validation.md), [UI toolkit](./ui-toolkit.md),
[i18n](./i18n.md).
