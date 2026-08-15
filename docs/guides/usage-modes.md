# Usage modes

There are three ways to put a Modyra form on a page, and they are independent of any framework. The
examples use `@modyra/plain`, the framework-free renderer, because it shows the model with nothing
in front of it. Every framework adapter offers the same three; only the syntax changes.

| Mode | You write | The form comes from | Best for |
| :--- | :--- | :--- | :--- |
| **Typed** | A TypeScript schema | Your code | New code — field paths checked at compile time |
| **Contract** | A JSON document | A server, a CMS, or Studio | Forms that change without a rebuild |
| **Headless** | Your own markup | Either of the above | An existing design system |

They mix. A typed form can render one contract-driven section, and a headless field can sit beside a
rendered one.

## Typed

The schema is TypeScript, so a typo in a field path is a compile error rather than a silently new
field.

```ts
import { createForm, field, group, min, required } from "@modyra/core";

const form = createForm({
  email: field("", [required()]),
  age: field<number | null>(null, [min(18)]),
  shipping: group({
    city: field("Rome"),
    zip: field(""),
  }),
});

form.f.shipping.city.set("Milan");
form.getValue().shipping.city;  // string
```

This form runs anywhere — a browser, a worker, a Node test — because nothing in it references a
rendering layer. See [typed forms](./typed-forms.md) for arrays, async validation, drafts and
history.

## Contract

The form is data: a list of fields, optionally a layout, in a document that can be stored, sent over
a network, or produced by a service in another language.

```ts
import { mountMdyForm } from "@modyra/plain";

const fields = [
  { name: "email", kind: "text", label: "Email", validators: { required: true } },
  { name: "country", kind: "select", label: "Country", options: [
    { value: "IT", label: "Italy" },
    { value: "FR", label: "France" },
  ] },
];

const { form, dispose } = mountMdyForm(document.querySelector("#form"), fields, {
  onSubmit: (value) => api.save(value),
});
```

`mountMdyForm` owns everything inside the container until you call `dispose()`. It returns the real
`@modyra/core` form, so anything the typed mode can do is available here too.

**When the document did not come from your code, parse it first.** TypeScript types do not validate
runtime data:

```ts
import { parseDynamicForm } from "@modyra/core";

const result = parseDynamicForm(await response.json(), { mode: "strict" });
if (!result.ok) return report(result.diagnostics);

mountMdyForm(container, result.fields, { layout: result.layout, rules: result.rules });
```

Strict mode returns nothing at all when any diagnostic exists — a partly valid document is never
accepted. Lenient mode keeps what parsed and reports the rest, which is what an editor preview
wants. See [forms as data](./ai-generated-forms.md) for the trust boundary in full.

## Headless

The engine drives your own components. Nothing is rendered for you, and nothing is assumed about
your markup.

```ts
import { createForm, field, required } from "@modyra/core";

const form = createForm({ email: field("", [required()]) });

// read
form.f.email.value();
form.f.email.errors();
form.f.email.pending();

// write
input.addEventListener("input", (e) => form.f.email.set(e.target.value));
input.addEventListener("blur", () => form.f.email.markAsTouched());
```

In a framework, the adapter does the subscribing — `useMdyForm` in React and Preact, a composable in
Vue, a store in Svelte, signals in Solid and Angular. The form model is identical in all of them.

**What headless costs you:** accessibility and theming become yours. `@modyra/widgets` publishes the
same part names, id policy, ARIA relations and class vocabulary the rendered catalogues use, so your
markup can be built from the definition rather than guessed — but nothing checks that it was. See
[headless recipes](./headless-recipes.md) for pairing with an existing component library.

## Choosing between them

- The form is known at build time and belongs to this application → **typed**.
- The form varies per customer, region or product, or is edited by someone who does not deploy →
  **contract**.
- You already have a design system you are not replacing → **headless**, in either of the above.

Per-framework detail lives with each adapter: [Angular](./usage-modes-angular.md) has three ways of
its own, and the [examples](../examples/checkout-scenario.md) implement one form in every adapter.
