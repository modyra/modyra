# Troubleshooting

**First move, always: open the inspector.** It shows every field's value, its valid, touched, dirty
and pending flags, and each error with its origin — `[validation]`, `[async]`, `[cross-field]` or
`[server]`.

It is part of the engine, so it works with any adapter:

```ts
import { mountMdyDevtools } from "@modyra/core/devtools";

const unmount = mountMdyDevtools(form, document.querySelector("#inspector"));
```

In Angular, add `mdyDevtools` to the `<mdy-form>` and press **Ctrl+Shift+D** for the same panel as
an overlay. See the [devtools guide](./devtools.md).

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
never settles: your async validator's promise never resolves — pass
`timeoutMs` to `serverValidator()`/`upsertAsyncValidators()` so the run
aborts and settles with a `kind: "async-timeout"` error instead of hanging
forever — or the value keeps changing (every change restarts debounce).

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

## Why is a control not registered, or its state empty?

- **A typo in the field name.** Anything that addresses a field by string — a template attribute, a
  contract document — creates a *new* field for an unrecognised name rather than failing. The typed
  handles (`form.f.email`) make the same mistake a compile error.
- **Two controls share one name.** Both bind to the same field, and dev mode warns about it. Rename
  one.
- **The control is outside the form.** It found no registry to claim a field from; dev mode logs it.

## Why did my value reset to null after `setValue()`?

`setValue` has **replace** semantics: fields absent from the passed object
are reset to `null`. Use `patch()`/`patchValue()` to change a subset.

## Why does `getChanges()` report an unchanged object field?

Leaves compare with `Object.is` (reference equality for objects/arrays).
A re-created array/object counts as changed even if deep-equal. See the
[mental model](./mental-model.md#how-equality-is-decided).
