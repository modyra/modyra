# Plain — the framework-free renderer

The other pages in this directory bind the engine to a framework. This one has no framework to bind
to: `@modyra/plain` takes a field list and builds real, interactive DOM directly.

```bash
npm install @modyra/core @modyra/plain
```

It is the only example here that renders a catalogue rather than showing you where to plug your own
markup in. `@modyra/angular` and `@modyra/lit` do too; the other five adapters are headless.

## What this example is not

`@modyra/plain` does **not** implement the [shared checkout scenario](checkout-scenario.md), and this
page does not pretend otherwise.

`mountMdyForm` builds a form from a **flat** field list. Two of the scenario's six requirements have
no expression in that input:

| Scenario requirement | Plain |
| --- | --- |
| Nested groups | Yes — a dotted name (`shipping.city`) is a path in the engine's flat registry |
| Server validation, debounced and cancelled | Yes — the field's own validators, unchanged |
| A cross-field dependency | Yes — same |
| Submit with server errors | Yes — `onSubmit` returns field errors, same contract as `form.submit()` |
| **A typed array with row add/remove** | **No** — the field list has no repeater, so there is no `items` handle to push to |
| **Drafts** | **No** — `mountMdyForm` takes no draft option |

Both are limits of this renderer's *input shape*, not of the engine. A host that builds its own
`MdyTypedForm` gets arrays and drafts and can render individual fields with `renderField`; what
`mountMdyForm` offers instead is that a contract alone is enough to get a running form.

That distinction is the point of the page. [Limits stay visible](../guides/usage-modes.md): an
adapter's coverage is documented rather than implied by its presence in this list.

## The form

```js
import { mountMdyForm } from "@modyra/plain";

const fields = [
  { name: "country", kind: "select", label: "Country", options: [
    { value: "IT", label: "Italy" },
    { value: "DE", label: "Germany" },
    { value: "US", label: "United States" },
  ] },
  { name: "shipping.city", kind: "text", label: "City", validators: { required: true } },
  { name: "shipping.zip", kind: "text", label: "ZIP", validators: { required: true, pattern: "^\\d{5}$" } },
  { name: "coupon", kind: "text", label: "Coupon" },
];

const { form, dispose } = mountMdyForm(document.querySelector("#checkout"), fields, {
  submitLabel: "Place order",
  layout: [
    {
      kind: "section",
      id: "shipping",
      label: "Shipping address",
      children: [{ kind: "columns", id: "city-zip", columns: [["shipping.city"], ["shipping.zip"]] }],
    },
  ],
  onSubmit: async (value) => {
    const res = await OrderApi.create(value);
    if (!res.ok) {
      return res.errors.map((e) => ({ path: e.field, kind: "server", message: e.message }));
    }
  },
});
```

`form` is a real `@modyra/core` form. Everything the other examples read from the engine is readable
here — `form.state.canSubmit()`, `form.state.pending()`, a field's value and errors — because it is
the same engine, reached without a framework in between.

`dispose()` unmounts every field, destroys the widget controllers and deactivates the form.

## Integration notes

- **Dots are naming, not nesting.** `shipping.city` is one flat key in the engine's registry, which
  is why a group needs no special support here. See the [mental model](../guides/mental-model.md).
- **The layout is contract data.** Sections become `<fieldset>`, column rows become a grid whose
  track count comes from the node, and either nests inside the other. A layout node is spliced in at
  the position of its first member, so a row built from two fields stays where those fields were.
  Fields the layout does not mention still render, appended after.
- **No CSS ships with the renderer.** Load a theme from `@modyra/styles` or the controls are
  structurally correct and unstyled. Every field carries the same classes `@modyra/angular` and
  `@modyra/lit` emit, because all three render the same
  [widget contract](../guides/ui-toolkit.md).
- **This is the renderer Studio previews through.** Studio's live canvas is `@modyra/plain`, so a
  form authored there and a form mounted here are the same code path.

## Going further

- [`@modyra/plain` package README](../../packages/plain/README.md) — full field-kind coverage table
- [Usage modes](../guides/usage-modes.md) — when a contract-driven renderer is the right choice
- [The widget contract](../guides/ui-toolkit.md) — what every renderer owes the catalogue
- Runnable source: `examples/plain/`
