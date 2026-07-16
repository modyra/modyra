# Mental model

How the library thinks, in one page. Read this before debugging anything.

## One flat engine, many facades

Every mode (typed, declarative, adapter, Zod, dynamic) drives the same engine:
`MdyDeclarativeAdapter`, a **flat** registry of fields keyed by string paths
(`"email"`, `"address.city"` — dots are naming, not nesting). `MdyTypedForm`
adds the nested typed view on top: it flattens patches going in and unflattens
values coming out. There is exactly **one source of truth per field**: the
`WritableSignal` holding its value inside the adapter record.

## The state graph

Everything else is derived with `computed` — never stored twice:

```text
value (signal)  ──┬─► errors = sync validators(value)
                  │            + asyncErrors (signal, written by the async runner)
                  │            + cross-field errors for this path
                  │            + server errors (while value === submitted value)
                  │
                  ├─► valid   = errors().length === 0
                  │
touched (signal) ─┤   (set by renderer blur / markAllTouched)
dirty   (signal) ─┤   (set by renderer input / markAsDirty)
required         ─┤   = any registered validator marks required
disabled/readonly─┘   = directive-provided signals

form.valid    = every field valid && no cross-field error
form.pending  = any field pending (async debounce+run window)
form.canSubmit= !submitting && (mode "valid-only" ? valid && !pending : mode "always")
```

## Field lifecycle

1. **Creation** — lazy, on first reference: a control claiming its `name`, a
   schema registering its paths, or `getField(path)`. Initial value:
   explicit `setInitialValue` wins, else the `[formValue]` seed, else `null`.
2. **Claiming** — controls reference-count the field (`claimField`). Two
   controls with the same name share state (dev-mode warning: usually a bug).
3. **Destruction** — when the **last** claim is released, the record (value,
   validators, flags, async runner effect) is dropped. An async validation
   resolving after destruction is discarded. A field that was never claimed
   (schema-registered) lives as long as the form.
4. **Renaming** — there is no rename: a changed `name` releases the old field
   and claims a new one; the old value is dropped with the last claim.

## Operation semantics

| Operation | Effect |
| :--- | :--- |
| `setValue(v)` | Replace: every field set; fields absent from `v` → `null` |
| `patchValue(p)` / `patch(p)` | Merge: only the given paths change |
| `reset()` | Values → declared initial values (else `null`); touched/dirty → false; server errors cleared |
| `submit(action)` | Gated by `canSubmit` (else marks all touched and returns); runs action; returned errors become server errors snapshotted against the submitted value |
| `undo()` / `redo()` | Restore recorded **values** only (never touched/dirty/errors) |
| `getChanges()` | `Object.is` diff of each leaf vs its initial value |
| `clearDraft()` | Removes the stored draft, re-baselines against the current value |

## Equality strategy

Leaf comparisons use `Object.is` — reference equality for objects/arrays,
value equality for primitives. `Date`/`File`/array leaves therefore compare
by reference: replacing one with an equal copy counts as a change. History
dedupe compares flat records key-by-key with `Object.is`. The core never
deep-compares and never uses `JSON.stringify` for equality (drafts serialize
for **storage**, not comparison).

## Error precedence and clearing

All error sources merge into one `errors()` array per field, each entry
tagged with its origin `kind`. Nothing overrides anything: `valid` means the
merged array is empty. Clearing rules:

- sync/cross-field: recomputed on every value change — clear themselves;
- async: replaced by the latest completed run (last-wins);
- server: shown while the field value still equals the submitted value —
  editing the field clears them; `reset()` clears all; a new submit replaces
  the whole set; unknown-path server errors surface on `errorsFor("")`.

## Where to look when it misbehaves

Open the devtools (`mdyDevtools` + Ctrl+Shift+D) — every signal above is
visible per field, errors carry their origin, and the JSON view shows the
exact flat value the engine holds. See the
[troubleshooting guide](./troubleshooting.md).

## Where the engine lives

Everything described above is implemented once, in the framework-agnostic
`@modyra/core` package (`MdyFormEngine` + `createForm`), written against a
four-primitive reactive contract (`signal`, `computed`, `effect`,
`untracked`). The Angular package binds that contract to Angular's native
signals via `angularReactivity`, so `MdyDeclarativeAdapter` and `mdyForm()`
are thin Angular-typed wrappers — same objects, same semantics, and the
whole engine also runs in plain Node on the built-in `vanillaReactivity()`.
