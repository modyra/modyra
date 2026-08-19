# Mental model

How the form engine works, in one page. Reading it first makes everything else — and most debugging
— shorter.

## One engine, several ways to reach it

Whichever way you create a form — typed, declarative, from a schema, from a Dynamic Form Contract —
you get the same engine underneath: `MdyFormEngine` in `@modyra/core`.

The engine holds a **flat registry of fields keyed by string paths**: `"email"`, `"address.city"`,
`"items.0.name"`. The dots are naming, not nesting. The typed view you write against
(`form.f.address.city`) sits on top: it flattens the paths going in and rebuilds the nested shape
coming out.

There is exactly **one source of truth per field** — the signal holding its value inside the
registry. Array rows are no exception: indexed paths are ordinary field paths, and a row-aware
manager registers and removes them as the array changes shape.

## What is stored, and what is derived

A field stores its value, whether it has been touched, whether it is dirty, and whatever an async
run has produced. Its validity, its merged error list, whether it is required, and whether it is
disabled or readonly are all **computed** from those — never stored a second time, so they cannot
disagree with what they are derived from.

```text
value (signal)  ──┬─► errors = sync validators(value)
                  │            + async errors (signal, written by the async runner)
                  │            + cross-field errors for this path
                  │            + server errors (while value === submitted value)
                  │
                  ├─► valid   = errors().length === 0
                  │
touched (signal) ─┤   (set on blur, or by markAllTouched)
dirty   (signal) ─┤   (set on input, or by markAsDirty)
required         ─┤   = any registered validator marks the field required
disabled/readonly─┘   = derived from one interactivity value, so the two cannot disagree

form.valid     = every field valid, and no cross-field error
form.pending   = any field pending (its debounce and run window)
form.canSubmit = not submitting, and — in "valid-only" mode — valid and not pending
```

## The life of a field

1. **Created lazily**, on first reference: a control claiming its name, a schema registering its
   paths, or a `getField(path)` call. Its initial value is an explicit `setInitialValue` if there is
   one, otherwise the seed value the form was given, otherwise `null`.
2. **Claimed.** Whatever drives a field claims it, and claims are reference-counted. Two controls
   claiming the same name share one field — usually a mistake, and dev mode says so.
3. **Destroyed** when the *last* claim is released: value, validators, flags and the async runner go
   with it. An async validation that resolves afterwards is discarded. A field that was never
   claimed — registered by a schema, say — lives as long as the form.
4. **Never renamed.** Changing a name releases the old field and claims a new one. The old value
   goes with the last claim.

Rows in a keyed collection add one rule: **the collection decides which rows exist**, and mounting a
control on a row does not bring that row into being. A claim for a path the collection has not
declared is held until it is.

## What each operation does

| Operation | Effect |
| :--- | :--- |
| `setValue(v)` | Replace. Every field is set; a field absent from `v` returns to its **declared initial**, not to `null` — the same rule `reset()` follows |
| `patchValue(p)` / `patch(p)` | Merge. Only the given paths change |
| `reset()` | Values return to their declared initial values, otherwise `null`; touched and dirty clear; server errors clear |
| `submit(action)` | Gated by `canSubmit` — if it fails, marks everything touched and returns. Errors the action returns become server errors, tied to the value that was submitted |
| `undo()` / `redo()` | Restore recorded **values** only, never touched, dirty or errors |
| `getChanges()` | An `Object.is` diff of each leaf against its initial value, minus the fields that are out of play — the same ones `submitValue()` withholds |
| `clearDraft()` | Removes the stored draft and re-baselines against the current value |

## How equality is decided

Leaf comparisons use `Object.is`: value equality for primitives, reference equality for everything
else. A `Date`, a `File` or an array therefore compares by reference — replacing one with an equal
copy counts as a change. History deduplication compares flat records key by key, the same way.

The engine never deep-compares and never uses `JSON.stringify` to decide equality. Drafts serialize
for *storage*, which is a different question.

## Where errors come from, and when they clear

Every source merges into one `errors()` array per field, and each entry is tagged with its origin.
Nothing overrides anything: `valid` means that merged array is empty.

- **sync and cross-field** — recomputed on every value change, so they clear themselves;
- **async** — replaced by the latest completed run; a stale response never wins;
- **server** — shown while the field still holds the value that was submitted. Editing the field
  clears them, `reset()` clears all of them, and a new submit replaces the set. Server errors on a
  path the form does not know surface on `errorsFor("")`.

## Where it runs

Everything above lives in `@modyra/core`, written against four reactive primitives: `signal`,
`computed`, `effect` and `untracked`.

An adapter supplies those four from its framework's own reactive system and re-types the result. It
adds no behaviour. That is why every adapter's form constructor is `createForm` underneath, why the
same form runs in plain Node on the built-in `vanillaReactivity()`, and why behaviour described in
these guides does not have to be checked again per framework.

## When it misbehaves

Open the [devtools](devtools.md): every signal above is visible per field, errors carry their
origin, and the JSON view shows the exact flat value the engine holds. Then see
[troubleshooting](troubleshooting.md).
