# ADR 0106: A door named for a contract reads it

Status: Accepted

## Context

The document path is three functions: `parseDynamicForm` → `buildDynamicFormSchema` →
`applyDynamicRules`. It takes an untrusted document — from a server, a CMS, a model — and produces a
running form, with the strict-mode diagnostics and the refusal of a partial form as the parts a host
most easily forgets.

`MdyDynamicFormComponent` is named for that contract and took only its *parsed* half: `[fields]`
already parsed and already typed, `[layout]` the same way. The untrusted half was left with the host.
So an application rendering one server document on `@modyra/plain` and on `@modyra/angular` wrote the
parse step twice — once as `mountMdyForm(container, result.fields, …)` and once by hand.

The cross-field rules were the part that vanished quietly. A document saying "hide the VAT number
unless the customer is a business" parsed, was accepted in strict mode, and produced an Angular form
that showed it always: nothing in the component ever reached `applyDynamicRules`.

## Decision

An adapter that publishes a door named for the dynamic contract reads the contract.

`MdyDynamicFormComponent` gains `[document]`, the document as it arrived, and reads it here:
parsed with `parseDynamicForm`, rendered from what that produced, with `applyDynamicRules` applied to
the inner form. `[parseMode]` chooses how — `strict` (the default) refuses a document carrying any
error and renders nothing rather than the part of it that happened to be well formed; `lenient`
renders what parsed. `(diagnostics)` emits what reading found, either way, so a host can show it.

`[fields]` stops being required. One of the two ways in is given; a component handed neither renders
nothing, which is what an empty list already meant.

## Consequences

A host that was parsing by hand can keep doing so — `[fields]` and `[layout]` are unchanged — and
one that was not now has the same door `@modyra/plain` has.

The component holds a parse. It is a `computed` rather than an effect because the fields and the
layout are two readings of one parse, and parsing per read would answer two different documents for
one input. That makes the document input's identity load-bearing: a host writing the object inline in
a template re-parses on every change detection, which is the same cost React's hook has and the same
answer — hold the document.

Making a required input optional widens what compiles. A template that forgot `[fields]` used to be
a compile error and is now a form with no fields, which is a worse failure to diagnose. It is the
price of the second door; the alternative was two components.

Strict mode rendering nothing is a deliberate refusal to render half a document. A host that wants
the well-formed part asks for `lenient` and gets the diagnostics with it.

## Alternatives rejected

**A second component for documents.** Two names for one thing, and the guide would have to say which
to reach for. The component is already named for the contract.

**Re-export the three functions from `@modyra/angular` and leave the component alone.** Satisfies a
source-level check and changes nothing for the host who has to call them in the right order and
decide what a diagnostic means.

**Parse in an effect and hold the result in a signal.** Two readings of one parse become two parses
unless the result is cached, and the cache is the `computed` this uses.

## Verification

- `packages/angular/src/lib/dynamic/mdy-dynamic-form-document.spec.ts` — a document renders, a
  strict-mode refusal renders nothing and reports why, and `lenient` renders what parsed.
- `battle-tests/adversarial/dynamic-contract/a-door-named-for-a-contract-it-does-not-read.battle.test.mjs`
  — asserts that an adapter naming the contract in its published surface also reads it.

## Security and privacy

This moves a trust boundary to where it belongs. The document is untrusted input, and it was being
parsed — or not — by each host separately, so a host that skipped strict mode rendered a document
nobody had checked: an unknown field kind, a validator outside the JSON-safe subset, a select whose
options a tampered document had widened. Parsing inside the component means the checks the contract
already has run by default, including the option whitelist `applyFlatValidators` registers. Nothing
new is stored or transmitted.
