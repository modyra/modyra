# Compared with Formik

An honest comparison — Formik was one of the first React form libraries to
get validation and array fields right, and still has broad production
mileage. This guide exists to help you decide, not to argue you out of it.

The side-by-side snippet below is not pseudocode: it's mirrored verbatim in
[`formik-migration.test.mjs`](../../docs/examples/formik-migration/formik-migration.test.mjs),
which builds both forms with equivalent validation and asserts they agree
on the same invalid → valid transition for the same sequence of email
values.

## Side by side

The same field in both APIs:

```tsx
// Formik
const { values, errors, handleChange, handleBlur } = useFormik({
  initialValues: { email: "" },
  validate: (v) => (!v.email ? { email: "Required" } : !isEmail(v.email) ? { email: "Invalid" } : {}),
  onSubmit: () => {},
});
// <input name="email" value={values.email} onChange={handleChange} onBlur={handleBlur} />
// state: errors.email — only meaningful once dirty or validateOnMount is set
```

```tsx
// @modyra/react
const form = useMdyForm({ email: field("", [required(), email()]) });
// <input value={form.f.email.value} onChange={(e) => form.f.email.set(e.target.value)} />
// state: form.f.email.errors — populated from the first render, no
// dirty-gating to reason about
```

## Concrete differences

| Aspect | Formik | @modyra/react |
| :--- | :--- | :--- |
| Validation | A single `validate(values)` function (or a Yup `validationSchema`) returning an errors object for the whole form | Per-field `field(initial, [validators])`, plus `crossField()` for rules spanning several fields — errors already attributed to the right field |
| `isValid` | Derived from `dirty` and the last validation run — a required-but-untouched field can read `isValid: true` before the user does anything, until `validateOnMount` is set | `form.state.canSubmit` reflects actual current validity, no dirty-gating to configure |
| Array fields | `<FieldArray>` render-prop component | Typed array helpers (`push`/`insert`/`remove`/`move`/`swap`) with compile-checked row paths |
| Async validation | Async `validate`, no built-in debounce/cancellation | `serverValidator()` — debounce + `AbortSignal` cancellation + timeout + last-wins, built in |
| Draft persistence | Not built in | Built in: debounced localStorage autosave, restore on load, field exclusion |
| Undo/redo | Not built in | Built in: debounced history, `form.mutate()` coalesces programmatic bursts |
| Framework | React only | Same engine + validators across Angular, React, Vue, Solid, Preact, Svelte, Lit |
| Ecosystem | Mature, years of production use, broad Stack Overflow coverage | Young; smaller surface, all first-party |

## The `isValid` gotcha (found while writing this guide's test)

Formik's `isValid` is derived, not authoritative: by default it's `true`
until the form becomes `dirty` **or** `validateOnMount: true` is set —
so a form with an empty required field can report `isValid: true` on
first paint. This guide's own test sidesteps the ambiguity by calling
`setFieldValue()` (which validates immediately) and reading the resulting
`errors` object directly, rather than trusting `isValid` — the same
approach we'd recommend for any migration: check `errors`, not `isValid`,
if you need to know validity before the user has touched anything.

Modyra's `form.state.canSubmit` has no such gate — it reflects the
schema's actual validity from the first computed value.

## Choose Formik if…

- You're all-in on React and want a library with a long production track
  record.
- Your validation logic is naturally expressed as "one function over the
  whole values object" (or you already have a Yup schema).

## Choose Modyra if…

- You want the same form logic to work outside React too.
- You want per-field error attribution, async validation with
  cancellation, drafts, undo/redo and injection prevention without
  assembling them yourself.
- You're comfortable with a younger library (pin versions, read the
  changelog).

## Performance

No head-to-head benchmark yet — see the "Where we lose" honesty note in
[the comparison doc](comparison-form-libraries.md#4-where-modyra-is-behind-read-this-before-adopting).
Formik re-renders the whole subscribed tree on most changes unless you
reach for `<FastField>`/`useField` scoping; Modyra's per-field reactive
state recomputes only that field's dependents by default — not measured
against each other on the same workload.
