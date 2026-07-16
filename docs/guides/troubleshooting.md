# Troubleshooting

First move, always: add `mdyDevtools` to the `<mdy-form>` and press
**Ctrl+Shift+D**. The panel shows every field's value, valid/touched/dirty/
pending and each error with its origin (`[validation]`, `[async]`,
`[cross-field]`, `[server]`).

## Why is `canSubmit()` false?

`canSubmit = !submitting && valid && !pending` (in the default
`"valid-only"` mode). In the devtools check, in order:

1. **valid: false** — filter "only invalid": some field has errors, or a
   cross-field validator failed (form-level errors show on `errorsFor("")`).
2. **pending: true** — an async validator is still in its debounce+run
   window; `canSubmit` waits for it by design.
3. **submitting: true** — the previous submit's promise never resolved.
   Check your action for a hanging request.
4. Mode is `"manual"` — `canSubmit` is always false there; drive submission
   yourself.

## Why is a field still `pending`?

`pending` covers the whole debounce window **plus** the validator run. If it
never settles: your async validator's promise never resolves (add a timeout
in your fetch layer — the library does not impose one), or the value keeps
changing (every change restarts debounce).

## Why was a server error cleared?

Server errors are snapshotted against the submitted value and shown **only
while the field still holds that value** — editing the field clears them
(that is the contract). They also clear on `reset()` and are replaced
wholesale by the next submit. An error whose `path` matches no registered
field is not lost: it surfaces on `errorsFor("")`.

## Why was my draft not restored?

In order of likelihood:

1. The draft was **cleared by a successful submit** (by design).
2. `ttlMs` expired or `version` changed — both discard the stored draft.
3. The field is listed in `exclude` — excluded fields are never restored.
4. The form was pristine when it last closed — a pristine form writes no
   draft.
5. Storage unavailable (private mode, blocked cookies, SSR) — the default
   storage silently degrades to a no-op.

## Why is a control not registered / its state empty?

- Typo in `name` (declarative mode creates a **new** field per unique name —
  a typo silently forks the state). Use typed `[field]` bindings to make
  this a compile error.
- Two controls share one name: both bind to the same state (dev-mode
  console warning). Rename one.
- The control sits outside the `<mdy-form>` element, so it found no
  registry — check the console for the dev-mode error.

## Why did my value reset to null after `setValue()`?

`setValue` has **replace** semantics: fields absent from the passed object
are reset to `null`. Use `patch()`/`patchValue()` to change a subset.

## Why does `getChanges()` report an unchanged object field?

Leaves compare with `Object.is` (reference equality for objects/arrays).
A re-created array/object counts as changed even if deep-equal. See the
[mental model](./mental-model.md#equality-strategy).
