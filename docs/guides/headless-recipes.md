# Headless recipes: shadcn/ui, Radix, Reka & friends

Modyra's engine is headless by design: `@modyra/core` owns the form state,
the framework adapters (`@modyra/react`, `@modyra/vue`, `@modyra/solid`,
`@modyra/preact`, `@modyra/svelte`) own reactivity, and **you** own the
markup. `@modyra/widgets` and `@modyra/styles` are one ready-made UI on
top — but if your design system is shadcn/ui, Radix, shadcn-vue/Reka,
Kobalte, Naive UI or plain Tailwind, the binding glue is a handful of
props-mappers.

This guide's helpers are not pseudocode: they are mirrored verbatim in the
adapter test suites (`packages/react/test/headless-recipes.test.mjs`,
`packages/vue/test/headless-recipes.test.mjs`,
`packages/solid/test/headless-recipes.test.mjs`,
`packages/preact/test/headless-recipes.test.mjs`,
`packages/svelte/test/headless-recipes.test.mjs`) and exercised against
the real engine on every CI run. Copy them into your project and tweak
freely — that is the headless ethos (and shadcn's own philosophy).

## The three binding contracts

Every component library speaks one of three props contracts. Map a Modyra
field handle onto the contract and the integration is done:

| Contract | Libraries / components | Props shape |
| :------- | :--------------------- | :---------- |
| **text input** | shadcn `Input`/`Textarea`, native elements | `value` + `onChange`/`onInput` + `onBlur` |
| **checked** | Radix/shadcn `Checkbox`, `Switch` | `checked`/`modelValue` (boolean or `"indeterminate"`) + change event |
| **value** | Radix/shadcn `Select`, `RadioGroup`, `ToggleGroup` | `value`/`modelValue` (string) + change event |

Two Modyra conventions to keep in mind:

- **`null` is the empty sentinel.** Map it to `""` for text/selects and to
  `false` for checkboxes — and map the component's empty state back to
  `null`, not `""`, so drafts/`getChanges()` stay clean.
- **Errors show after touch.** Pristine fields never display errors; a
  failed submit calls `form.markAllTouched()` to surface everything.

## React + shadcn/ui

Setup per shadcn docs (`npx shadcn@latest add input checkbox select`).
The form:

```tsx
import { useMdyForm, useMdyField, field, required, email } from "@modyra/react";

const form = useMdyForm(() => ({
  email: field("", [required(), email()]),
  age: field<number | null>(null, []),
  terms: field<boolean | null>(null, [required()]),
  plan: field<string | null>(null, [required()]),
  toppings: field<string[]>([]),
}));
```

The props-mappers (call them during render, after `useMdyField` has
subscribed the component):

```tsx
/** shadcn <Input>/<Textarea> and native elements. */
function mdyInputProps(handle) {
  return {
    value: handle.value() ?? "",
    onChange: (e) => handle.set(e.target.value),
    onBlur: () => handle.markAsTouched(),
    disabled: handle.disabled(),
    // Invalid styling/AT only after touch — never yell at pristine fields.
    "aria-invalid": (handle.touched() && !handle.valid()) || undefined,
    "aria-required": handle.required() || undefined,
  };
}

/** Numeric variant: empty input maps to Modyra's null sentinel. */
function mdyNumberInputProps(handle) {
  const props = mdyInputProps(handle);
  return {
    ...props,
    onChange: (e) => {
      const n = e.target.valueAsNumber;
      handle.set(Number.isNaN(n) ? null : n);
    },
  };
}

/** Radix Checkbox/Switch: `checked` may be true | false | "indeterminate". */
function mdyCheckedProps(handle) {
  return {
    checked: handle.value() === true,
    onCheckedChange: (checked) => handle.set(checked === true),
    disabled: handle.disabled(),
    "aria-invalid": (handle.touched() && !handle.valid()) || undefined,
  };
}

/** Radix Select/RadioGroup: values are strings, empty means "no choice". */
function mdyValueProps(handle) {
  return {
    value: handle.value() == null ? "" : String(handle.value()),
    onValueChange: (value) => handle.set(value),
    disabled: handle.disabled(),
  };
}

/** Checkbox groups: the field holds an array of selected option values. */
function mdyMultiCheckedProps(handle, option) {
  const selected = () => (Array.isArray(handle.value()) ? handle.value() : []);
  return {
    checked: selected().includes(option),
    onCheckedChange: (checked) => {
      const current = selected();
      handle.set(
        checked === true
          ? [...current, option]
          : current.filter((v) => v !== option),
      );
    },
    disabled: handle.disabled(),
  };
}

/** Errors render only after touch; submit calls form.markAllTouched(). */
function mdyTouchedErrors(handle) {
  return handle.touched() ? handle.errors() : [];
}
```

A complete field component:

```tsx
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function EmailField({ handle }: { handle: MdyFieldHandle<string> }) {
  const f = useMdyField(handle); // subscribes the component
  const errors = mdyTouchedErrors(handle);
  return (
    <div className="grid gap-2">
      <Label htmlFor="email">
        Email {handle.required() && <span aria-hidden="true">*</span>}
      </Label>
      <Input id="email" type="email" {...mdyInputProps(handle)} />
      {f.pending && <p role="status">checking…</p>}
      {errors.length > 0 && (
        <ul role="alert" className="text-sm text-destructive">
          {errors.map((e) => <li key={e.message}>{e.message}</li>)}
        </ul>
      )}
    </div>
  );
}
```

Checkbox, select and multi-select follow the same shape:

```tsx
<Checkbox {...mdyCheckedProps(form.f.terms)} />

<Select {...mdyValueProps(form.f.plan)}>
  <SelectTrigger><SelectValue placeholder="Pick a plan" /></SelectTrigger>
  <SelectContent>
    <SelectItem value="free">Free</SelectItem>
    <SelectItem value="pro">Pro</SelectItem>
  </SelectContent>
</Select>

{["mushrooms", "olives"].map((t) => (
  <Checkbox key={t} {...mdyMultiCheckedProps(form.f.toppings, t)} />
))}
```

Submit: `form.submit(async (value) => …)` — on failure the engine stores
the server errors and `markAllTouched()`-style display is already handled;
call `form.markAllTouched()` yourself when rendering without a submit
handler.

### Preact: the same recipes, unchanged

`@modyra/preact` is a thin variant of the React adapter on `preact/hooks` —
every function above works with zero edits, since they only ever touch the
framework-agnostic field handle (`handle.value()`, `.set()`, `.errors()`…),
never a React-specific API. `packages/preact/test/headless-recipes.test.mjs`
is this section's code copied byte-for-byte (only the file header comment
differs) as coverage, not just a claim. Swap the imports for
`useMdyForm`/`useMdyField` from `@modyra/preact` and the rest of this
section applies as written — including the shadcn component snippets,
since Preact's JSX output is React-compatible.

### Svelte: same recipe logic, wrap reads in a store

`@modyra/svelte` runs on `vanillaReactivity()` (Svelte 5 runes are
compiler macros a library's own build step can't resolve — see the
package README), so its field handles are the same framework-agnostic
shape as React/Preact's. The recipe functions above work unchanged as
plain logic — coverage: `packages/svelte/test/headless-recipes.test.mjs` is
that same code, byte-for-byte (only the header comment differs), and it
passes with zero edits. The one real difference: a `.svelte` template
auto-subscribes to a `$store` value, not a raw function call the way
Solid's compiler tracks an accessor — so wrap each handle read through
`toStore()` (or the `useMdyField`/`useMdySelect` widgets bridge, which
already returns `state`/`view` as real Svelte `Readable`s) before binding
it in markup, rather than calling `handle.value()` directly in a
template expression.

## Vue + shadcn-vue / Reka UI

Form state is real Vue reactivity under the hood, so the recipes are plain
computed wrappers — templates track them natively:

```ts
import { computed } from "vue";

/** Native text inputs; shadcn-vue <Input>/<Textarea> forward these attrs. */
function useMdyInputProps(handle) {
  return {
    value: computed(() => handle.value() ?? ""),
    disabled: computed(() => handle.disabled()),
    "aria-invalid": computed(
      () => (handle.touched() && !handle.valid()) || undefined,
    ),
    "aria-required": computed(() => handle.required() || undefined),
    onInput: (e) => handle.set(e.target.value),
    onBlur: () => handle.markAsTouched(),
  };
}

/**
 * Reka/shadcn-vue modelValue components (Checkbox, Switch, Select,
 * RadioGroup). `emptyValue` is what the component shows for Modyra's null
 * sentinel: "" for selects/radios, false for checkboxes/switches.
 */
function useMdyModelProps(handle, emptyValue = "") {
  return {
    modelValue: computed(() => handle.value() ?? emptyValue),
    "onUpdate:modelValue": (v) => handle.set(v === "" ? null : v),
    disabled: computed(() => handle.disabled()),
  };
}

/** One checkbox per option; the field holds an array of selected values. */
function useMdyMultiCheckedProps(handle, option) {
  const selected = () => (Array.isArray(handle.value()) ? handle.value() : []);
  return {
    modelValue: computed(() => selected().includes(option)),
    "onUpdate:modelValue": (checked) => {
      const current = selected();
      handle.set(
        checked === true
          ? [...current, option]
          : current.filter((v) => v !== option),
      );
    },
    disabled: computed(() => handle.disabled()),
  };
}

/** Errors render only after touch; submit calls form.markAllTouched(). */
function useMdyTouchedErrors(handle) {
  return computed(() => (handle.touched() ? handle.errors() : []));
}
```

Usage in a component:

```vue
<script setup lang="ts">
import { useVueForm, field, required, email } from "@modyra/vue";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

const form = useVueForm({
  email: field("", [required(), email()]),
  terms: field<boolean | null>(null, [required()]),
});
const emailProps = useMdyInputProps(form.f.email);
const emailErrors = useMdyTouchedErrors(form.f.email);
const termsProps = useMdyModelProps(form.f.terms, false);
</script>

<template>
  <Input type="email" v-bind="emailProps" />
  <ul v-if="emailErrors.length" role="alert">
    <li v-for="e in emailErrors" :key="e.message">{{ e.message }}</li>
  </ul>
  <Checkbox v-bind="termsProps" />
</template>
```

One adapter note: engine APIs that take a **signal** (`setDisabled`,
`setReadonly`) expect a zero-arg function — wrap Vue refs/computed as
`() => myRef.value`:

```ts
const locked = computed(() => account.value.locked);
form.setDisabled("email", () => locked.value);
```

## Solid + Kobalte / shadcn-solid

Solid's fine-grained reactivity means a field handle is read directly as
an accessor inside JSX — no subscription hook needed at all. The same
props-mapper functions from the React section work completely unchanged
here too (coverage: `packages/solid/test/headless-recipes.test.mjs` is that
same code, byte-for-byte), because they only call the field handle's own
methods. The one thing that differs is *when* you call them: not once per
render (Solid components run once), but inline in the JSX expression that
should track them.

```tsx
import { createSolidForm, field, required, email } from "@modyra/solid";

const form = createSolidForm({
  email: field("", [required(), email()]),
  terms: field<boolean | null>(null, [required()]),
});
```

```tsx
import { Checkbox } from "@kobalte/core/checkbox";

function EmailField(props: { handle: MdyFieldHandle<string> }) {
  const { handle } = props;
  return (
    <div class="grid gap-2">
      <label for="email">
        Email {handle.required() && <span aria-hidden="true">*</span>}
      </label>
      {/* Call mdyInputProps() inline — Solid's compiler tracks each
          accessor read (handle.value(), handle.errors()…) individually,
          so only the affected attribute updates, never the whole node. */}
      <input id="email" type="email" {...mdyInputProps(handle)} />
      {handle.pending() && <p role="status">checking…</p>}
      {mdyTouchedErrors(handle).length > 0 && (
        <ul role="alert">
          {mdyTouchedErrors(handle).map((e) => <li>{e.message}</li>)}
        </ul>
      )}
    </div>
  );
}
```

```tsx
<Checkbox.Root {...mdyCheckedProps(form.f.terms)}>
  <Checkbox.Input />
  <Checkbox.Control />
</Checkbox.Root>
```

No `useMdyField` call, no re-render bookkeeping — this is the clearest
demonstration of "native signals map almost 1:1 onto the engine's
contract" (see `examples/solid/main.jsx` for the full signup form built
this way).

## Arranging a config-driven form

A Contract config can carry a `layout`: sections, and rows divided into
columns, with per-breakpoint counts and placements. The rendering adapters
(`@modyra/angular`, `@modyra/plain`) apply it for you. Headless packages
render no elements, so nothing there can apply it — but the arrangement is
not theirs to invent either. Two framework-free functions in
`@modyra/widgets` turn a layout node into the classes and custom properties
`@modyra/styles` already understands, and they are the same two functions
both rendering adapters call:

```jsx
import {
  MDY_LAYOUT_CLASSES,
  layoutNodeAttributes,
  layoutSlotStyle,
} from "@modyra/widgets";

/** What a child asks of the column it sits in — a slot and a section answer alike. */
function placementOf(child) {
  if (typeof child === "string") return undefined;
  if ("ref" in child) return child.at;                     // v3 slot
  return child.kind === "section" ? child.at : undefined;  // a group inside a row
}

function LayoutNode({ node, renderField }) {
  const { className, style } = layoutNodeAttributes(node);

  if (node.kind === "section") {
    return (
      <fieldset className={className} data-layout-id={node.id}>
        {node.label && <legend className={MDY_LAYOUT_CLASSES.sectionLabel}>{node.label}</legend>}
        {node.children.map((child, i) => (
          <LayoutChild key={i} child={child} renderField={renderField} />
        ))}
      </fieldset>
    );
  }

  return (
    <div className={className} style={style} data-layout-id={node.id}>
      {node.columns.map((column, i) => (
        // The column is the grid item, so a placement is applied here and not to
        // anything inside it. The first child with something to say wins.
        <div key={i} className={MDY_LAYOUT_CLASSES.column} style={layoutSlotStyle(column.map(placementOf).find(Boolean))}>
          {column.map((child, j) => (
            <LayoutChild key={j} child={child} renderField={renderField} />
          ))}
        </div>
      ))}
    </div>
  );
}

function LayoutChild({ child, renderField }) {
  if (typeof child === "string") return renderField(child);
  if ("ref" in child) return renderField(child.ref);
  return <LayoutNode node={child} renderField={renderField} />;
}
```

`renderField` is your own field markup from the recipes above, looked up by
name. The JSX is React's; everything it walks is framework-free, so the Vue,
Solid, Preact and Svelte versions differ only in how they spell an element —
which is why this one is covered once
(`packages/react/test/headless-recipes.test.mjs`) rather than five times.
Three things are worth knowing:

- **The custom properties are the whole responsive story.** A row's track
  count per breakpoint, a column's starting track, whether it shows at a
  size — all of it arrives as `--mdy-layout-*` on the elements above, and
  `@modyra/styles` reads them from **container** queries, so a form nested
  in a narrow panel arranges itself for the panel rather than for the
  window.
- **Splice, don't hoist.** A layout that arranges only part of a form must
  leave the rest where the author put it: render each node at the position
  of its first member, not all the nodes first.
- **Don't spell the classes yourself.** `MDY_LAYOUT_CLASSES` is the same
  vocabulary every adapter and every theme uses; a literal string here is
  how one renderer's two-column row stops matching another's.

## A widget controller without a wrapper

`@modyra/react` ships a hook for each widget controller. The other four reactivity
adapters ship two, and that is a deliberate gap rather than an oversight: a wrapper
is ergonomics, not capability. Every controller in `@modyra/widgets` takes a field
handle and a reactive runtime, and both are things you already have.

```ts
import { observerFor } from "@modyra/core";
import { createDatepickerFieldController } from "@modyra/widgets";

// `observerFor` resolves the runtime that owns the handle. Building a fresh one
// works by accident — it stops working, silently, the moment the handle belongs
// to a form built by another adapter, because nothing re-renders and nothing says so.
const controller = createDatepickerFieldController(
  { widgetId: "birthday", handle: form.f.birthday },
  observerFor(form.f.birthday),
);
```

From there the controller is the same object a hook would have handed you:

- `controller.state()` — the semantic state to render from;
- `controller.view()` — the classes, ids and ARIA for each part;
- `controller.dispatch(intent)` — returns the commands to execute;
- `controller.destroy()` — call it when your component goes away.

Two things your host has to do, and they are the only two a wrapper does for you:

```ts
// 1. Re-render when the controller changes. Both signals, not one: the view is a
//    computed over the state today, and the contract does not promise it stays that way.
const stop = subscribeController(controller, observerFor(handle), () => rerender());

// 2. Execute the commands a dispatch returns, deferred the way your host renders.
const runtime = createCommandRuntime({
  announcerId: "mdy-my-app-announcer",
  defer: (run) => queueMicrotask(run),   // or requestAnimationFrame, or your host's promise
});
runtime.execute(controller.dispatch({ type: "open" }), lookup, handlers);
```

Both helpers are exported from `@modyra/widgets`. `defer` is the only part that is
genuinely yours: it is *when* your host has finished rendering, and focusing before
that moves focus to a node the host is about to replace.

This recipe runs in the framework-free laboratory (`npm run demo:plain`, the
**Headless** panel) and is checked by its browser suite, so it cannot rot into a
snippet that no longer compiles.

## Accessibility checklist

The recipes encode these; keep them when customizing:

- `aria-invalid` only when **touched and invalid** — a pristine required
  field is not an error state.
- `aria-required` mirrors the schema (`required()` marks the field, so the
  star and the attribute can never drift apart).
- Error lists use `role="alert"` (they appear/disappear, so screen readers
  announce them); async spinners use `role="status"`.
- `disabled` always flows from the engine — never freeze it in markup.

## Notes and combos

- **Security:** pair headless fields with a form-level
  `security: { sanitize: "text" }` — pasted bidi/zero-width characters are
  stripped at the engine choke point no matter which component wrote the
  value (see [Injection prevention](security.md)).
- **Async validators:** `f.pending` covers the whole debounce+run window —
  render a spinner next to the input, and keep the submit button bound to
  `form.state.canSubmit`.
- **Full apps:** [`examples/react`](../../examples/react/main.jsx),
  [`examples/vue`](../../examples/vue/main.js),
  [`examples/preact`](../../examples/preact/main.jsx) and
  [`examples/solid`](../../examples/solid/main.jsx) are complete
  single-file demos (cross-field validation, drafts, undo/redo,
  cancellable server checks) using the same handle pattern with Modyra's
  own theme CSS.
- **Where to put the mappers:** they are plain functions — colocate them
  with your components, in a module of your own next to them, and extend
  them as your design system grows (date pickers, comboboxes, sliders).
