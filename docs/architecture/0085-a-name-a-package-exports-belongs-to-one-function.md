# ADR 0085: A name a package exports belongs to one function

Status: Accepted

## Context

`@modyra/react` and `@modyra/preact` each shipped two different functions under one identifier.
`packages/react/src/index.ts` declares `useMdyField(handle)` — the field-state hook, the one every README and
example calls — and `packages/react/src/widgets/index.ts` exports `useMdyField(handle, options)` — the headless
text-field controller hook. The entry point does `export * from "./widgets/index.js"`, and an
`export *` yields to a local declaration silently, by specification. So the widget hook compiled,
shipped, and published its types (`MdyReactFieldApi`, `UseMdyFieldOptions` and the Preact twins)
through the declarations built from `packages/react/src/widgets/field.ts`, while a consumer of the package root could never reach it. The
arity a consumer measured was 1: the local hook won and nothing reported the loser.

Finding 92 pinned it with a source-level battle, because at runtime only the survivor exists and the
shadowing is invisible from outside.

## Decision

**The widget hook is renamed, not the field-state hook.** In both packages the text-field controller
hook is now `useMdyTextField`, with `UseMdyTextFieldOptions` and `MdyReactTextFieldApi` /
`MdyPreactTextFieldApi`. The field-state hook keeps `useMdyField`.

The name follows the family the widget bridge already uses: every other hook in `widgets/` names the
control it wraps — `useMdyBooleanField`, `useMdyOptionField`, `useMdyMultiselectField`,
`useMdyDatepickerField`, `useMdyTimepickerField` — and the controller underneath is
`createTextFieldController`. `useMdyField` was the only member of that family named after its
parameter instead of its control, and that is exactly why it collided.

**The field-state hook does not move.** It is the documented, one-argument hook every consumer
imports (`useMdyField(form.f.email)` in the READMEs, the examples, and the apps), and renaming it
would break every working consumer to rescue a function none of them could call.

## Consequences

**Nothing reachable is taken away.** The widget `useMdyField` could not be imported from the package
root before, so no working code loses an export. `useMdyTextField` is newly reachable — the first
time the text-field bridge has actually been available from either package.

**The three type names were technically reachable** — they are pure types, and `export *` passed
them along because no local declaration claimed them — so their rename is the one real break, for a
reader who imported types describing a function the package would not hand over. Both packages are
pre-1.0, and the bump is `minor`, the breaking-change bump at 0.x.

**`@modyra/solid`, `@modyra/svelte` and `@modyra/vue` keep `useMdyField` as the widget hook.** In
those packages it is the only function by that name — nothing shadows it, and their READMEs document
it — so renaming there would be churn against no defect. The result is an accepted divergence: the
text-field bridge is `useMdyTextField` where `useMdyField` was already taken, and `useMdyField`
where it was not.

## Alternatives rejected

**Drop the widget module.** The headless text-field bridge is real, tested, and advertised in the
package READMEs as part of the widgets story; deleting it to fix a name would remove capability to
avoid choosing a word.

**Add a `./widgets` subpath entry point.** That keeps the collision intact — two functions, one
name, now reachable through two doors — and asks every consumer to learn which door hands over
which. A subpath is the right answer when a subtree is a separate concern; this one is eight hooks
of one bridge.

**Rename the field-state hook.** See above: it breaks every working consumer of both packages.

## Verification

- `node --test battle-tests/adversarial/reactivity/a-name-that-shadows-an-export.battle.test.mjs` —
  the source-level scan finds no name an entry declares that another of its modules also exports.
- `packages/react/test/widgets.test.mjs`, `packages/preact/test/widgets.test.mjs` — both names now
  arrive from the package root, with the arities that tell them apart: `useMdyField.length === 1`,
  `useMdyTextField.length === 2`.

## Security and privacy

None. A rename of exports in two adapter packages.
