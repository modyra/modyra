# ADR 0057: An argument is refused where it arrives

Status: Accepted

## Context

The engine checks a *path* where it arrives: `getField(42)` throws, naming the argument, from the
call the caller wrote. Its other arguments were not checked, and seven public entry points shared one
failure shape — accept something they cannot use, return normally, and leave the form to fail
somewhere else.

```js
form.setDisabled("rows.a.code", true);   // the shape is () => true
form.state.valid();                      // TypeError: disabledSignal(...) is not a function
```

`setDisabled`, `setReadonly` and `setInactive` take a zero-argument function; `addValidators`,
`upsertValidators` and `upsertAsyncValidators` take a list of them. These are the adapter-facing
surface — a framework's own reactive value passes through them on every binding, and a ref or a plain
boolean is the ordinary mistake. Nothing calls the argument until a later read composes it, so the
stored value fails `disabled()`, `readonly()`, `state.valid()`, `submitValue()` and `errorsFor()`
with a message naming an engine internal. `getValue()` keeps answering, so the form looks alive while
it can no longer be validated or submitted.

`setValue` and `setInitialValue` fail in the other direction: they take anything and damage the form
silently.

```js
form.setValue("nope");    // every field null, every collection empty, state.valid() true
```

The engine's own `explainValueMismatch("text", null)` calls that result `text cannot hold null`. Two
readings of one baseline disagreed: a field absent from a whole-value write went to `null`, while
`reset()` returned the same field to its initial. `setInitialValue` planted whatever it was given
where `reset()` returns for the rest of the form's life.

That this is a gap rather than a house style is what the rest of the surface settles: `patch`,
`patchValue`, `rows.upsert`, `rows.patch`, `rows.setAll` and `items.setAll` take the same wrong
values and damage nothing.

## Decision

**A reactive argument is a zero-argument function, and one that is not is refused at the call.** The
message names the parameter and the shape received, and says what to wrap: `() => ref.value`. The
list-taking setters refuse anything that is not an array of functions, by the same rule.

**A whole-value write takes the whole value.** `setValue` refuses a string, a number, `null`,
`undefined` and an array, because none of them is a form value and emptying the form is not what the
caller meant by any of them.

**A field a whole value does not name returns to its initial**, which is the rule `reset()` already
follows and a state the form could have started in. It is *named* that decides, not what it holds: a
path present and holding null is written, a path absent is restored.

**An initial value has the shape of the initial it replaces.** A schema states no kind, so the
declared initial is all the engine knows about what a field holds; a replacement of a different type
is refused, and a field whose schema declared `null` or nothing is left alone.

**Loud, and in production.** These refusals throw rather than warn under `MDY_DEV`, because the state
they prevent — a form that cannot be read, or one silently emptied — is worse in production than a
thrown error the caller can see. It matches the path check, which has always thrown.

## Consequences

Code that passed a plain boolean where a signal belongs now throws where it previously appeared to
work. TypeScript declared these parameters all along, so a typed consumer is unaffected; an adapter
author who was passing a ref was already broken and now finds out at the call.

`setValue({})` no longer empties a field to `null` but returns it to its initial. A consumer who
relied on `setValue` to null out a field that declares an initial must write the null.

The initial-shape check is the weakest of the four: it protects only fields whose schema declared a
non-null initial. A field declaring `null` — an optional number, a date — accepts any baseline, and
that gap is the price of a typed schema having no kinds to check against.

Refusing at the door means a wrong argument now ends a render pass instead of degrading it. That is
the intended trade: an adapter that poisons one binding poisoned the whole form's readability
anyway, only later and with a message naming something the author never wrote.

## Alternatives rejected

**Hold the argument in something the reads survive** — wrap a non-function as `() => value`. The
battle admits it, and it makes an adapter author's mistake invisible: the binding silently stops
being reactive, which is the failure the reactivity contract exists to make loud.

**Warn under `MDY_DEV` and carry on.** Production is where a poisoned form is unrecoverable, and the
warning is stripped exactly there.

**Refuse an initial by validating the value against the field's kind.** A typed schema has no kinds;
`explainValueMismatch` answers for a *document's* kinds, which a typed form does not carry.

**Leave `setValue` as it was and refuse only the argument.** It closes the string and the number and
leaves the object whose keys the schema does not know — which is the shape a wrong server response
actually takes.

## Verification

- `battle-tests/adversarial/reactivity/signal-shaped-arguments.battle.test.mjs` — five setters given
  a value they cannot call, with the documented shape as the control.
- `battle-tests/adversarial/validation/a-whole-value-that-is-not-one.battle.test.mjs` — six wrong
  whole values and five wrong initials, checked against `explainValueMismatch`.
- `battle-tests/adversarial/persistence/undo-of-a-whole-write.battle.test.mjs` — the undo path no
  longer offers a state the form could not have held.
- `packages/core/test/` — the workspace suite, which exercises every internal caller of these
  setters; `@modyra/angular` is the only package outside core that calls them, through `signal()`
  and `computed()`.

## Security and privacy

`setValue` is an ingress: a server response, a restored session, an object built by another layer.
Refusing a value that is not a form value removes a way for a wrong-shaped or hostile response to
silently erase what a user typed while the form goes on reporting itself valid and submittable. The
initial check removes a baseline that a form can never be clean against, which was a way to make
`getChanges()` report a value nobody entered. Neither refusal reveals the value it rejected: the
messages name the shape, never the content.
