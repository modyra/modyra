# Compared with react-hook-form

An honest comparison — react-hook-form is a good, popular library with a
huge ecosystem. This guide exists to help you decide, not to argue you out
of it.

The side-by-side snippet below is not pseudocode: it's mirrored verbatim in
[`rhf-migration.test.mjs`](../../docs/examples/rhf-migration/rhf-migration.test.mjs),
which builds both forms and asserts they agree on the same invalid → valid
transition for the same sequence of email values.

## Side by side

The same field in both APIs:

```tsx
// react-hook-form
const { register, formState } = useForm({ mode: "onChange" });
// <input {...register("email", { required: true, pattern: /.../ })} />
// state: formState.errors.email, formState.isValid — a lazily-tracked
// proxy; a key only starts updating once something reads it during render
```

```tsx
// @modyra/react
const form = useMdyForm({ email: field("", [required(), email()]) });
// <input value={form.f.email.value} onChange={(e) => form.f.email.set(e.target.value)} />
// state: form.f.email.valid, form.f.email.errors — plain values, no proxy,
// nothing to remember to read first
```

## Concrete differences

| Aspect | react-hook-form | @modyra/react |
| :--- | :--- | :--- |
| Validation rules | Per-field `register()` options (`required`, `pattern`, `validate`) or a schema `resolver` (zod/yup via `@hookform/resolvers`) | `field(initial, [validators])` — same validator functions across every adapter, not React-specific |
| `formState` | A Proxy: a key (`errors`, `isValid`, `isDirty`…) only computes and re-renders once your component reads it during render — easy to reach for `.isValid` in a `useEffect` and see nothing update | Plain reactive state (`valid()`/`value()` signal-shaped in every adapter) — no read-to-subscribe step to remember |
| Async validation | Custom `validate` function, returns a Promise; no built-in debounce or cancellation | `serverValidator()` — debounce + `AbortSignal` cancellation + timeout + last-wins, built in |
| Cross-field validation | Manual: read other fields via `getValues()`/`watch()` inside a `validate` function | `crossField([...names], (values) => error \| null)` — declared once, attributed to the named fields |
| Draft persistence | Not built in (community `useFormPersist`) | Built in: debounced localStorage autosave, restore on load, field exclusion (e.g. passwords) |
| Undo/redo | Not built in | Built in: debounced history, `form.mutate()` coalesces programmatic bursts |
| Bundle | Uncontrolled-by-default, no dependencies | No runtime dependencies; realistic surface measured smaller — see [the comparison doc](comparison-form-libraries.md) |
| Ecosystem | Huge — `@hookform/resolvers`, devtools, years of Stack Overflow coverage | Young; smaller surface, all first-party |

## The formState proxy gotcha (found while writing this guide's test)

`useForm()`'s `formState` object is intentionally lazy: RHF only starts
computing (and re-rendering on) a given key once your component reads it
during render — a real perf optimization, but a footgun the first time you
hit it. Reading `formState.errors` from a ref, an effect, or after the
fact **does not** turn on tracking; only a render-time read does. The
project's own test for this guide hit exactly this: validation errors
silently stayed empty until the harness component destructured
`const { errors } = formState` during render. If your migrated form's
validation "just doesn't seem to run," check this first.

Modyra's field state (`form.f.email.valid`, `.errors`, `.value`) has no
proxy step — reading it anywhere, any time, reflects the current value.

## Choose react-hook-form if…

- You're all-in on React (no plans to reuse the form logic elsewhere).
- You want the biggest ecosystem: resolvers, devtools, community answers.
- Uncontrolled-by-default performance characteristics matter to your case.

## Choose Modyra if…

- You want the same form logic to work outside React too (Vue, Angular,
  Solid, Svelte, Lit, Preact, or no framework at all).
- You want async validation, drafts, undo/redo, cross-field rules and
  injection prevention without assembling them from separate packages.
- You're comfortable with a younger library (pin versions, read the
  changelog).

## Performance

No head-to-head benchmark yet — see the "Where we lose" honesty note in
[the comparison doc](comparison-form-libraries.md#4-where-modyra-is-behind-read-this-before-adopting).
Architecturally, RHF's uncontrolled-by-default model avoids most re-renders
by not touching React state per keystroke; Modyra's per-field reactive
state means an update recomputes only that field's dependents, not the
whole tree, but the two approaches haven't been measured against each
other on the same workload.
