# @modyra/plain

A zero-dependency vanilla JS/HTML5 renderer for the [Modyra](https://github.com/modyra/modyra)
form engine. Given a container element and a flat Dynamic Form Contract
field list, `mountMdyForm` builds a real, running `@modyra/core` form and
renders real, interactive DOM for every field — no virtual DOM, no
template engine, no framework runtime. Only dependencies:
`@modyra/core` and `@modyra/widgets` (also framework-free).

```bash
npm install @modyra/plain
```

```ts
import { mountMdyForm } from "@modyra/plain";

const fields = [
  { name: "name", kind: "text", label: "Name", validators: { required: true } },
  { name: "country", kind: "select", label: "Country", options: [
    { value: "IT", label: "Italy" },
    { value: "FR", label: "France" },
  ] },
];

const { form, dispose } = mountMdyForm(document.querySelector("#form"), fields, {
  onSubmit: (value) => fetch("/api/submit", { method: "POST", body: JSON.stringify(value) }),
});

// form is a real @modyra/core MdyTypedForm — read state.canSubmit(),
// state.pending(), form.f.name.value(), etc. directly.
dispose(); // unmounts every field, destroys controllers, deactivates the form
```

`fields` is the same `MdyDynamicField[]` shape `useMdyDynamicForm` in
`@modyra/react` and `<mdy-dynamic-form>` in `@modyra/angular` already
consume — parse it from JSON yourself with `parseDynamicForm()`
(`@modyra/core`) if it comes from a CMS or a Studio-compiled Contract.

## Field kind coverage

Every `MdyDynamicField` kind renders via the matching headless controller
in `@modyra/widgets`:

| Kind | Controller | Real DOM |
|---|---|---|
| `text`, `textarea`, `email`, `password`, `number`, `slider` | `createFieldController` | native `<input>`/`<textarea>` |
| `checkbox`, `toggle` | `createBooleanFieldController` | native `<input type=checkbox>` |
| `radio`, `segmented` | `createOptionFieldController` | native `<input type=radio>` group |
| `select` | `createSelectController` | combobox trigger + listbox popup |
| `multiselect` | `createMultiselectFieldController` | search input + toggle/counter chips |
| `datepicker` | `createDatepickerFieldController` | trigger + 42-cell calendar grid, arrow-key nav |
| `timepicker` | `createTimepickerFieldController` | trigger + hour/minute inputs, draft/commit |

`slider` needs no distinct controller — it is structurally just a numeric
field rendered as `<input type=range>`. `daterange`, `colors` and `file` are
not implemented here yet; `@modyra/lit`'s catalog covers them.

## Layout

Pass a Contract v2 `layout` to arrange the form. Sections render as
`<fieldset>`, column rows as a grid whose track count comes from the node, and
either can nest inside the other:

```ts
mountMdyForm(host, fields, {
  layout: [
    {
      kind: "section",
      id: "address",
      label: "Address",
      children: ["street", { kind: "columns", id: "cityZip", columns: [["city"], ["zip"]] }],
    },
  ],
});
```

A layout node is spliced in at the position of its first member rather than
hoisted, so a row built from fields 3 and 4 stays between 2 and 5. Fields the
layout does not mention still render, in their declared order — a partial
layout arranges part of the form instead of dropping the rest.

## Theme classes

Every field renders the same structure `@modyra/angular` and `@modyra/lit` do —
`mdy-renderer`, `mdy-label` (with `mdy-label__required`), `mdy-input-wrapper`
(with `__inliner`), `mdy-supporting-text`, `mdy-control__errors` — plus the
state classes `mdy-renderer--touched`, `mdy-input-wrapper--error/--disabled`
and `mdy-label--filled`. Load a theme from `@modyra/styles` to style them.

This package ships **no CSS of its own**: without a theme the controls are
structurally correct but unstyled.

## Used by Modyra Studio

`apps/plain-preview` in the Modyra monorepo closes the loop back to
[Studio](https://github.com/modyra/modyra): paste a project exported from
Studio's own Export tab (JSON target), and it is run through the real
`loadProject → compileToContract → flattenContractFields` pipeline
(`@modyra/studio-model`, `@modyra/studio-contract`) and rendered here —
a genuinely interactive form built from whatever you designed in the
Studio editor, with zero framework runtime.

## License

MIT © [Lorenzo Muscherà](https://github.com/lorenzomusche)
