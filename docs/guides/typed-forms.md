# Typed forms — `mdyForm()`

Schema-first and fully type-safe: initial values and validators live in
TypeScript, and `[field]` replaces the stringly `name` attribute — **a typo
on a field path is a compile error**. Groups nest arbitrarily and map to
dotted adapter paths (`address.city`).

```ts
import { field, group, mdyForm, mdyRequired, mdyEmail, mdyMin } from "@modyra/angular";

export class SignupComponent {
  readonly form = mdyForm({
    email: field("", [mdyRequired(), mdyEmail()]),
    age: field<number | null>(null, [mdyMin(18)]),
    address: group({ city: field("Rome"), zip: field("") }),
  });

  save = async (): Promise<void> => {
    await this.form.submit(async (value) => {
      // value: { email: string; age: number | null; address: { city: string; zip: string } }
      return api.signup(value); // pseudocode — return MdyFormError[] to show server errors
    });
  };
}
```

```html
<mdy-form [form]="form" (submitted)="onSubmitted($event)">
  <mdy-control-text [field]="form.f.email" label="Email" />
  <mdy-control-number [field]="form.f.age" label="Age" />
  <mdy-control-text [field]="form.f.address.city" label="City" />
  <button type="submit" [disabled]="!form.state.canSubmit()">Sign up</button>
</mdy-form>
```

Every handle on `form.f` is reactive and typed: `value()`, `errors()`,
`touched()`, `dirty()`, `valid()`, `pending()`, `required()`, `set(v)`.
`name`-based controls and validator directives keep working inside the same
`<mdy-form [form]>` — adoption is incremental.

These contracts are enforced by compile-time tests
(`typed-form.types.spec.ts` uses `@ts-expect-error` to prove that wrong
paths, wrong value types and incomplete `setValue()` calls do not compile).

## Model operations — exact semantics

| Operation | Semantics |
| :--- | :--- |
| `getValue()` | Nested typed value of every schema field |
| `setValue(v)` | **Replace**: requires the complete model; schema fields absent from `v` are reset to `null` |
| `patch(p)` | Deep-partial merge — only the given paths change |
| `reset()` | Back to the **schema initial values**; clears touched/dirty and the last submit errors |
| `getChanges()` | Minimal nested patch: only fields whose value differs (`Object.is`) from the schema initials |
| `submit(action)` | No-op (marks all touched) when `canSubmit()` is false; sets `submitting`, runs `action`, stores returned `MdyFormError[]` as server errors |

Limits worth knowing:

- `getChanges()` compares leaf values with `Object.is` — an array or object
  leaf that was mutated in place *and* replaced with an equal copy still
  counts as changed (reference comparison, no deep equality).
- `dirty` is set by user interaction in renderers (and `markAsDirty()`);
  programmatic `set()`/`patch()` does not flip it.

## Async validation

```ts
username: field("", [mdyRequired()], {
  asyncValidators: [async (v) => (await isTaken(v)) ? ["Name taken"] : []],
  asyncDebounceMs: 300,
}),
```

- `pending()` covers the whole debounce+run window; `canSubmit()` waits.
- Results are last-wins: out-of-order responses for stale values are dropped.
- A rejected promise becomes an `"async"` error with the rejection message.
- There is no built-in `AbortSignal` cancellation yet — stale results are
  discarded, but in-flight requests are not aborted.

## Undo / redo

```ts
const form = mdyForm(schema, { history: { maxEntries: 100, debounceMs: 300 } });
form.undo();      // restore previous snapshot
form.redo();      // re-apply
form.canUndo();   // reactive — drive toolbar buttons
```

- Pass `history: true` for defaults (100 entries, no debounce).
- `debounceMs` batches rapid keystrokes into a single undo step — recommended
  for text-heavy forms, otherwise every keystroke becomes an entry.
- Only the **value** is recorded: touched/dirty flags, server errors and
  validation state are not restored by undo/redo.
- `undo()`/`redo()` flush a pending debounced snapshot first, so no typing is
  silently lost.

## Draft autosave

```ts
const form = mdyForm(schema, {
  draft: {
    key: "signup",
    exclude: ["password"],   // never persisted nor restored
    ttlMs: 24 * 3600_000,    // discard drafts older than a day
    version: 1,              // bump when the form shape changes
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

Declarative shorthand: `[draftKey]="'signup'"` on `<mdy-form>`, or
`draft: "signup"` in `mdyForm()` options for an all-defaults draft.

## Multi-step wizard

`<mdy-form-wizard>` splits one form into steps with per-step validation,
progress header and navigation:

```html
<mdy-form [form]="form">
  <mdy-form-wizard (finished)="save()">
    <mdy-wizard-step label="Account" [fields]="[form.f.email, form.f.password]">
      <mdy-control-text [field]="form.f.email" label="Email" />
    </mdy-wizard-step>
    <mdy-wizard-step label="Address" [fields]="[form.f.address.city]">…</mdy-wizard-step>
  </mdy-form-wizard>
</mdy-form>
```

"Next" is gated on the active step's `[fields]` (invalid fields get marked
touched), steps stay alive when hidden (values survive navigation), the step
header allows jumping backwards freely and forwards only across valid steps.
Combine with `draft:` for long forms that survive a browser crash.

## Zod adapter — `@modyra/angular/zod`

One source of truth for types, validators, messages and required flags — the
same schema your backend/tRPC layer already uses. Ships as a secondary entry
point with `zod` as an **optional** peer: zero weight if you don't use it.

```ts
import { mdyFormFromSchema } from "@modyra/angular/zod";
import { z } from "zod";

readonly form = mdyFormFromSchema(
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
on the path they declare. The result is a regular `MdyTypedForm`.

Known inference limits: `preprocess`/`transform` (the form works on the
**input** type; transformed output types are not reflected in handles),
unions and discriminated unions (treated as plain leaves), recursive
schemas (not supported), coercion (`z.coerce` parses on validate, but the
handle type stays the input type). `optional()` fields use `null` as the
empty sentinel and are normalized back to `undefined` for `safeParse`.
