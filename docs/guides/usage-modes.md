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

## A condition in both modes

The two modes differ in one place that decides what the mode is *for*, and it is easy to read past.
A condition — when a field applies, when a section shows — is written as **code** in the typed mode
and as **data** in the contract mode.

```ts
// Typed: a closure. It reads the form value and answers.
reason: field("", [required()], {
  when: (_value, form) => form.kind === "detailed",
}),
```

```json
// Contract: an expression. The same question as a tree of enumerated operators.
{ "op": "equals", "operands": [{ "path": "kind" }, "detailed"] }
```

The closure is the better tool where it works: it is your language, your editor, your types. What it
cannot do is leave the process.

```
JSON.stringify({ name: "reason", kind: "text", label: "R", when: (v, f) => … })
→ {"name":"reason","kind":"text","label":"R"}
```

**The condition is gone and nothing said so.** A function has no JSON representation, so a document
carrying a closure arrives as a document with no rule in it — valid, renderable, and missing the
behaviour its author wrote. That is the whole reason the expression form exists: a form that travels
as data has to carry its behaviour as data too, or it does not really travel.

### The expression, and what its limits buy

An expression is a closed tree: sixteen enumerated operators over `{ "path": … }` references and
literals. Everything a document can say, it says with those.

```ts
import { evaluateExpression, expressionPaths, validateExpression } from "@modyra/core";

const rule = {
  op: "and",
  operands: [
    { op: "equals", operands: [{ path: "kind" }, "detailed"] },
    { op: "isNotEmpty", operand: { path: "reason" } },
  ],
};

validateExpression(rule);                                   // [] — nothing wrong with it
expressionPaths(rule);                                      // ["kind", "reason"]
evaluateExpression(rule, { kind: "detailed", reason: "x" }); // true
evaluateExpression(rule, { kind: "simple", reason: "" });    // false
```

The three limits read as restrictions and are the opposite — they are what makes it safe to accept a
condition from a document you did not write:

- **The operator set is closed.** An unknown operator is a refusal, not an extension point:
  `validateExpression({ op: "nope", … })` answers `["unknown operator \"nope\""]`. There is no
  `eval`, no callback, no string that becomes code.
- **Depth is capped** at `MDY_MAX_EXPRESSION_DEPTH`, which is `32`. A tree 33 levels deep is refused
  with *"nests deeper than 32 levels"* rather than recursed into.
- **Patterns are cost-gated.** A `matches` whose regex backtracks exponentially is refused where the
  condition is checked, and the evaluator answers `false` without running it — see
  [what has been attacked](./hostile-input.md#a-pattern-that-would-stop-the-page-is-refused-at-parse).

`validateExpression` is the authoring tool: it says *why* a condition is malformed rather than
failing later with a form that quietly does nothing. `expressionPaths` derives what a rule reads,
which is how a tool can answer "what does this rule depend on" without executing it.

### Where the capability stops

An expression covers conditions — a field's `when`, a section's visibility, a `validations` entry.
It does not cover everything a closure can be. A `serverValidator()` takes a function and only a
function, so Studio holds a serializable condition while it is being edited and **prints a closure**
when it generates code. The rule survives as data up to the boundary of the thing that cannot read
data, and there it becomes code again.

Two further gaps are worth knowing before you plan around this: a document's `validations` are
compiled but no shipped renderer mounts them ([forms as data](./ai-generated-forms.md#cross-field-validations-are-parsed-and-no-renderer-mounts-them)),
and the reasoning behind the whole division is
[ADR 0092](../architecture/0092-a-condition-travels-with-the-form.md).

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
