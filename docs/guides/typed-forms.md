# Typed forms

The form's shape lives in TypeScript, and you reach a field through a handle rather than a string —
so **a typo on a field path does not compile**. Groups nest as deeply as you like and map to dotted
paths underneath (`address.city`).

Everything on this page is `@modyra/core`, which means it is true in every adapter. Only the
constructor and the way you bind a control change; [the table below](#the-same-form-in-each-adapter)
says how.

```ts
import { createForm, email, field, group, min, required } from "@modyra/core";

const form = createForm({
  email: field("", [required(), email()]),
  age: field<number | null>(null, [min(18)]),
  address: group({ city: field("Rome"), zip: field("") }),
});

form.f.email.set("ada@example.com");
form.f.address.city.value();  // "Rome"
form.getValue();              // { email: string; age: number | null; address: { city: string; zip: string } }

await form.submit(async (value) => api.signup(value));
```

`submit` returns whatever your action returns; hand back an `MdyFormError[]` to show server errors on
their fields.

Every handle on `form.f` is reactive and typed: `value()`, `errors()`, `touched()`, `dirty()`,
`valid()`, `pending()`, `required()`, `set(v)`. `form.getValue()` gives the whole nested value;
`form.value()` is the same thing as a signal, for a template that wants to track it.

The typing is not a claim: a suite of compile-time tests uses `@ts-expect-error` to prove that a
wrong path, a wrong value type and an incomplete `setValue()` all fail to compile.

## The same form, in each adapter

| Package | Constructor | Binding a control |
| :------ | :---------- | :---------------- |
| `@modyra/core`, `@modyra/plain` | `createForm(schema)` | `renderField(container, descriptor, handle)` |
| `@modyra/angular` | `mdyForm(schema)` | `<mdy-control-text [field]="form.f.email" />` |
| `@modyra/react`, `@modyra/preact` | `useMdyForm(() => schema)` | `<MdyTextField field={form.f.email} />` |
| `@modyra/lit` | `createLitForm(schema)` | `<mdy-text-field .field=${form.f.email}>` |
| `@modyra/vue` | `createVueForm(schema)` / `useVueForm` | `<MdyTextField :field="form.f.email" />` |
| `@modyra/solid` | `createSolidForm(schema)` / `useSolidForm` | `<MdyTextField field={form.f.email} />` |
| `@modyra/svelte` | `createSvelteForm(schema)` | `<MdyTextField field={form.f.email} />` |

Each constructor is `createForm` with that framework's reactivity supplied,
and each returns the same `form.f` tree. What follows uses `createForm`; read
it as whichever line of the table you are on.

Where a section is about one adapter's own surface — a template syntax, a
component — it says so in its heading.

## Model operations — exact semantics

| Operation        | Semantics                                                                                                                                  |
| :--------------- | :----------------------------------------------------------------------------------------------------------------------------------------- |
| `getValue()`     | Nested typed value of every schema field                                                                                                   |
| `setValue(v)`    | **Replace**: requires the complete model; schema fields absent from `v` are reset to `null`                                                |
| `patch(p)`       | Deep-partial merge — only the given paths change                                                                                           |
| `reset()`        | Back to the **schema initial values**; clears touched/dirty and the last submit errors                                                     |
| `getChanges()`   | Minimal nested patch: only fields whose value differs (`Object.is`) from the schema initials                                               |
| `submit(action)` | No-op (marks all touched) when `canSubmit()` is false; sets `submitting`, runs `action`, stores returned `MdyFormError[]` as server errors |

Limits worth knowing:

- `getChanges()` compares leaf values with `Object.is` — an array or object
  leaf that was mutated in place _and_ replaced with an equal copy still
  counts as changed (reference comparison, no deep equality).
- `dirty` is set by user interaction in renderers (and `markAsDirty()`);
  programmatic `set()`/`patch()` does not flip it.

## Async validation

The ergonomic path is `serverValidator()` — you call your own service method,
the library handles debounce, cancellation, pending, last-wins and timeout:

```ts
import { field, serverValidator } from "@modyra/core";

phone: field("", [required()], serverValidator(
  async (phone, ctx) => {
    const country = ctx.form.fieldValue("country"); // read a sibling field
    const res = await api.phoneLookup(phone, country, { signal: ctx.signal }); // cancellable
    return res.valid ? null : "Phone number not reachable";
  },
  {
    dependsOn: ["country"], // re-run when this field changes
    debounceMs: 400,
    timeoutMs: 5000,        // settle pending even if the call hangs
    when: (v) => PHONE_RE.test(v), // skip the call for obviously invalid input
  },
)),
```

The lower-level `asyncValidators`/`asyncDebounceMs` (and their `dependsOn`/
`timeoutMs`/`when` siblings) are still available on `field()`'s options if
you'd rather write the validator function directly:

```ts
username: field("", [required()], {
  asyncValidators: [async (v, ctx) => (await isTaken(v, { signal: ctx.signal })) ? ["Name taken"] : []],
  asyncDebounceMs: 300,
}),
```

- `pending()` covers the whole debounce+run window; `canSubmit()` waits.
- Results are last-wins: out-of-order responses for stale values are dropped.
- A rejected promise becomes an `"async"` error with the rejection message.
- `ctx.signal` is an `AbortSignal` aborted when the run is superseded
  (last-wins), re-debounced, or the form is destroyed — pass it to `fetch`
  or your own service call to cancel in-flight requests. An aborted run
  never produces an error.
- `ctx.form.value()` / `ctx.form.fieldValue(path)` give read-only access to
  the rest of the form for cross-field server checks.
- `dependsOn` fields must already exist in the schema — with the typed API
  this is always true, since `createForm()` registers every field
  upfront.
- `timeoutMs` bounds how long a field can stay `pending`: past the deadline
  the run is aborted and the field gets a `kind: "async-timeout"` error.
- `when(value, formValue)` is evaluated before `pending` turns on; returning
  `false` skips the call entirely (useful to avoid paying for calls to a
  billed API on obviously-invalid input).

## Undo / redo

```ts
const form = createForm(schema, { history: { maxEntries: 100, debounceMs: 300 } });
form.undo(); // restore previous snapshot
form.redo(); // re-apply
form.canUndo(); // reactive — drive toolbar buttons
```

- Pass `history: true` for defaults (100 entries, `debounceMs: 0`).
- Because the default records every keystroke, set `debounceMs` for text-heavy
  forms so rapid typing collapses into a single undo step.
- Only the **value** is recorded: touched/dirty flags, server errors and
  validation state are not restored by undo/redo.
- `undo()`/`redo()` flush a pending debounced snapshot first, so no typing is
  silently lost.

## Batching changes — `form.mutate()`

```ts
form.mutate(() => {
  form.f.firstName.set("Lorenzo");
  form.f.lastName.set("Muscherà");
});
```

Groups every field write inside the callback into **exactly one** history
entry (when `history` is enabled) — `form.undo()` afterwards restores both
fields together, not one write at a time. Works the same way regardless of
which adapter the form runs on, including ones whose effects run
synchronously rather than being scheduler-deferred: `mutate()` doesn't rely
on a particular effect-timing model to coalesce correctly. Nested
`mutate()` calls collapse into the outermost call's single entry. A form
with no `history` option still runs the callback normally — `mutate()` is
never required, only useful.

## Construction vs activation (SSR, Strict Mode)

```ts
const form = createForm(schema, { autoActivate: false });
// ... later, once you actually want draft/history/async validators running:
form.activate();
// ... to pause them again without losing any state:
form.deactivate();
```

By default (`autoActivate: true`, unchanged from before this option
existed) draft persistence, history recording and async validators all
start the moment the form is constructed. Passing `autoActivate: false`
defers all three until you call `activate()` — construction does nothing
but build the field graph: no timer, no storage read, no network call.
`deactivate()` pauses them again without losing any state (field values,
undo/redo stacks, the draft baseline all survive); `activate()` resumes
exactly where it left off. Both are idempotent and safe to call any
number of times in any order.

This is what makes `@modyra/react` and `@modyra/preact`'s `useMdyForm`
safe under React Strict Mode's dev-only mount→unmount→remount cycle and
during SSR: the hook constructs with `autoActivate: false` and calls
`form.activate()` in its effect / `form.deactivate()` on cleanup, instead
of the effect ever running before hydration or corrupting state across the
extra dev-mode cycle. Angular, Vue, Solid, Svelte and Lit forms typically
never need to touch `autoActivate`/`activate()`/`deactivate()` directly —
their construction model already matches the default (`autoActivate:
true`) behavior.

## Field arrays

`array()` declares a repeatable list of fields or groups — order lines,
passengers, phone numbers. Rows are typed: a typo on a row's field path is a
compile error, same as everywhere else on `form.f`.

```ts
import { array, createForm, field, group, minLength, required } from "@modyra/core";

const form = createForm({
  items: array(
    group({ name: field("", [required()]), qty: field<number>(1) }),
    { initial: [{ name: "First", qty: 2 }], validators: [minLength(1)] },
  ),
});

form.f.items.length();                 // Signal<number>
form.f.items.rows();                   // Signal<ReadonlyArray<row handle>>
form.f.items.at(0)?.name.set("x");
form.f.items.push({ name: "", qty: 1 });
form.f.items.insert(1, { name: "b", qty: 3 });
form.f.items.remove(0);
form.f.items.move(0, 2);
form.f.items.errors();                 // array-level errors (e.g. minLength)
form.getValue().items;                 // Array<{ name: string; qty: number }>
```

Rendering the rows, in Angular:

```html
@for (row of form.f.items.rows(); track $index) {
  <mdy-control-text [field]="row.name" label="Item" />
}
<button type="button" (click)="form.f.items.push({ name: '', qty: 1 })">Add item</button>
```

`array(field(""))` (a leaf item, not a group) makes `rows()` a list of plain
`MdyFieldHandle`s instead of nested group handles.

**Structure follows value.**
`push`/`insert`/`remove`/`move`/`setAll`, and any `patch()`/`setValue()`/
`reset()` that touches the array's path, fully rebuild the array's rows
(remove every row, re-register the new set) instead of reindexing fields in
place. This is intentional — no ghost state survives a reindex — but it
means **touched/dirty and per-row errors reset on every structural change**,
even for rows that did not move. Editing a value inside an existing row
(`row.name.set(...)`) never touches structure and does not reset anything.

**History/draft interaction:** `undo()`/`redo()` and draft restore write
through the flat engine directly. Growing the array this way (draft restore
introducing more rows, or `redo()` re-applying a `push`) is fully reconciled:
new rows get their validators registered reactively. Undoing *across* a
structural change (e.g. undoing a `push`) restores every row's **values**
correctly, but the extra row's fields stay registered (with null values)
until the next structural operation prunes them — `undo()` does not shrink
`rows()` on its own. Plain value edits inside rows undo/redo like any other
field.

Array-level validators (`{ validators: [minLength(1)] }`) run against the
whole array value and gate `state.valid` and `form.f.items.errors()`, same
as `errorsFor("items")`.

## Keyed collections — `record()`

`array()` keys rows by position. `record()` keys them by a value the domain
owns — an entity id, a provisional key, a slug:

```ts
const schema = {
  rows: record(group({ name: field(""), qty: field(0, [min(1)]) })),
};

form.f.rows.upsert("a3f9", { name: "Espresso", qty: 2 });
form.f.rows.cell("a3f9", "name").set("Ristretto");
form.value().rows; // { a3f9: { name: "Ristretto", qty: 2 } }
```

Reach for it when a position is not a stable name for a row: the collection
is sorted or filtered by something outside the form, rows carry ids the
server assigns, or — the case `array()` cannot serve at all — **the controls
of one row are mounted apart**, as a table rendering column by column does.

### A row exists because it was declared

`upsert` brings a row into being, `remove` ends it. Mounting a control does
neither, and three properties follow:

- **A control that mounts on an undeclared key claims nothing.** It renders
  empty and binds when the key arrives. It never brings the row into being,
  so what is on screen cannot change the data model.
- **Unmounting a control keeps the value.** The row does not depend on the
  rendering, so there is nothing to preserve — a cell leaving the DOM is not
  an edit.
- **Validity belongs to the declared row.** A form holding an invalid row
  stays invalid however few of its controls are mounted, so sorting or
  filtering a table never lights up a disabled submit button.

`remove(key)` is the only way a row's value goes away, and it takes it even
while controls are showing it; those controls go back to waiting.

### Cells

`cell(key, path)` returns the same handle every time, across `upsert`,
`remove` and `upsert` again — a renderer holds it and never re-binds:

```html
<!-- one column, mounting one cell of every row -->
<mdy-control-text [field]="form.f.rows.cell(row.key, 'name')" />
```

`row(key)` gives the row's whole handle tree, `keys()` the declared keys in
declaration order, and `validOf(key)` one row's verdict. Everything on the
handle reads live — `has(key)` and `validOf(key)` included, so a template may
call them and will see the answer change.

Declaring rows costs what you would expect and no more: 500 rows in one
`setAll` land in tens of milliseconds, and one more row after that is
constant time.

### Keys

A key is one path segment: it may not contain `.`, and prototype-polluting
names are refused. A rejected key is reported and dropped rather than
thrown, because keys arrive from outside.

Numeric-looking keys are ordinary — `"12"` is what a serialised entity id
looks like — and a record is never turned into an array by them.

### Moving a key

`remove` then `upsert` carries the value. `rename(from, to)` also carries
`touched`, which is what a provisional key becoming a definitive one wants:

```ts
form.f.rows.rename("tmp:1", String(saved.id));
```

### Rewriting, merging, emptying

`upsert(key, value)` **rewrites** the row: a field the value does not name
goes back to the initial its schema declares. `patch({ [key]: partial })`
**merges** into rows that exist, leaving their other fields alone, and writes
several in one call. What the user did — `touched`, `dirty` — survives both.

`setAll(rows)` declares exactly the keys it is given, and `setAll({})` is how
you empty a collection deliberately; handed something that is not an object
it declares nothing and says so, because a stray `undefined` from a response
should not erase a table.

Record-level validators run against the whole collection, like array-level
ones.

`getChanges()` reports **changed values, not structure** — for records as for
arrays. Removing a row that the schema seeded leaves nothing in the change
set, because the fields it compared are gone. Read `keys()` against what you
started from when a removal is itself something you need to send.

In development, the collection reports the calls that could not do anything:
a `cell()` path the row does not have, a `rename` onto a key already taken, a
patch whose row value is not an object. `devWarnings: false` silences them
with everything else.

### In a data-only document

The Dynamic Form Contract has the node too, beside `group` and `array`:

```json
{
  "node": "record",
  "item": { "node": "group", "children": { "name": { "node": "field", "field": { "kind": "text" } } } },
  "initialValue": { "12": { "name": "Espresso" } }
}
```

A document declares the shape of a row and the rows it starts with. Which
rows exist afterwards stays the application's word — a document describes a
form, not a session.

### Seeing it work

`npm run demo:plain` (or `demo:angular`, or `demo:lit`) ends with a table rendered **by column**,
with rows that enter and leave edit mode, a sort, and a provisional key that becomes a real one.

`e2e/record-table/table.spec.ts` asserts the thing it is there to show: sorting the table, closing
every editor and unmounting cells change no value and no verdict.

## Draft autosave

```ts
const form = createForm(schema, {
  draft: {
    key: "signup",
    exclude: ["password"], // never persisted nor restored
    ttlMs: 24 * 3600_000, // discard drafts older than a day
    version: 1, // bump when the form shape changes
    debounceMs: 400,
  },
});
```

> **Security warning — read before enabling drafts.**
> The default storage is `localStorage`: plain text, readable by every script
> on the origin, and it survives logout. **Always `exclude` passwords, card
> numbers, tokens and any other sensitive field.** For anything stricter,
> provide your own `MdyDraftStorage` (encrypted, server-side, session-scoped…).

Behavior:

- The value is persisted (debounced) on every change and restored on
  creation; `hasDraft()` tells you a draft was applied, `clearDraft()`
  removes it.
- The draft clears itself after an error-free submit.
- A pristine form writes no draft.
- Drafts are stored in a versioned envelope with a `savedAt` timestamp;
  a version mismatch or expired `ttlMs` discards the draft instead of
  restoring it. Corrupt JSON, missing storage, quota errors and browsers
  that block `localStorage` are all handled silently.
- `File` values are never persisted (not serializable).
- On the server (SSR) the default storage is inert.

In Angular the same thing has a template shorthand:
`[draftKey]="'signup'"` on `<mdy-form>`.

## Multi-step wizard — Angular

`<mdy-form-wizard>` splits one form into steps with per-step validation,
progress header and navigation:

```html
<mdy-form [form]="form">
  <mdy-form-wizard (finished)="save()">
    <mdy-wizard-step label="Account" [fields]="[form.f.email, form.f.password]">
      <mdy-control-text [field]="form.f.email" label="Email" />
    </mdy-wizard-step>
    <mdy-wizard-step label="Address" [fields]="[form.f.address.city]"
      >…</mdy-wizard-step
    >
  </mdy-form-wizard>
</mdy-form>
```

"Next" is gated on the active step's `[fields]` (invalid fields get marked
touched), steps stay alive when hidden (values survive navigation), the step
header allows jumping backwards freely and forwards only across valid steps.
Combine with `draft:` for long forms that survive a browser crash.

## From a Zod schema — `@modyra/zod`

One source of truth for types, validators, messages and required flags — the
same schema your backend already uses. `zod` is an **optional** peer: zero
weight if you don't use it.

```ts
import { createZodForm } from "@modyra/zod";
import { z } from "zod";

const form = createZodForm(
  z.object({
    email: z.string().email(),
    age: z.number().min(18).default(18),
    address: z.object({ city: z.string().min(1), zip: z.string().default("") }),
  }).refine(v => v.age >= 21 || v.address.city !== "", {
    path: ["address", "city"],
    message: "City required under 21",
  }),
);
```

Nested `z.object()`s become groups, `.default()`/`.optional()` seed initial
values, pieces that reject empty values drive `aria-required`, and
object-level `refine()`/`superRefine()` issues surface as cross-field errors
on the path they declare. The result is a regular typed form.

The introspection — tree building, piece validators, required detection,
refinement mapping — is framework-agnostic and lives in `@modyra/zod`. An
adapter may wrap it to bind the result to its own reactivity:
`mdyFormFromSchema` from `@modyra/angular/zod` is `createZodForm` on Angular
signals, and takes the same schema.

Known inference limits: `preprocess`/`transform` (the form works on the
**input** type; transformed output types are not reflected in handles),
unions and discriminated unions (treated as plain leaves), recursive
schemas (not supported), coercion (`z.coerce` parses on validate, but the
handle type stays the input type). `optional()` fields use `null` as the
empty sentinel and are normalized back to `undefined` for `safeParse`.
