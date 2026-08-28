# ADR 0166: A key is data, not syntax

Status: Accepted

## Context

A widget that holds several values tells one chosen value from another by a key derived from the
value. The derivation is the contract's — `defaultOptionKey` — and for anything that is not a
primitive it produces a *structural* key: the value's own contents, canonically ordered, as a string.
An object value gets `{"id":1,"name":"Red"}`.

That is correct as a key and is not a legal attribute selector. The first quote closes the selector,
and the browser answers `SyntaxError` — it raises rather than returning nothing, and takes the
handler that called it with it. Two of five representative held values do this: an object, and any
string carrying a quote.

Renderers had eight places building `[data-key="${key}"]` from one. The gestures affected are the
ones that act on a single chip: landing focus after a removal, focusing a chip after a move,
measuring chip midpoints during a drag. With object values every one of them raised.

Underneath was a second divergence with the same root. The order a strip lays chips out in — distinct
chosen keys, in the order the value holds them — was derived independently in all three renderers.
Two used the contract's key function. One used `String(value)`, which agrees with the contract on
every primitive and collapses every object to `[object Object]`. Its strip *painted* correctly,
because painting reads the controller; every gesture that indexes into the strip was indexing into a
list of one. A strip of five chips reordered as though it held one.

Neither was caught, and the reason is the same for both: nothing exercised a value that was not a
string. On strings a selector and a comparison agree, and `String` and `defaultOptionKey` agree.

## Decision

**A key derived from a value is compared, never interpolated into a selector.** `elementByDataKey`
finds the element carrying a key by reading the attribute back and comparing it. Escaping is not the
answer here: `CSS.escape` is a browser global this package must not require — it computes in
processes with no DOM — and a hand-rolled escape for attribute values is a second set of rules to
keep correct against a first that already works.

**The order the chips are in is the contract's answer, asked for by name.** `chosenKeyOrder` returns
the distinct chosen keys in the order the value holds them. Renderers read it; none derives it. A
renderer that derives its own has a second key function, and two key functions that agree on strings
are not two implementations of one rule — they are one rule and one bug that has not been reached.

## Consequences

Two exported names widen the public surface additively, and both are DOM-facing helpers in a package
that is otherwise mostly declaration. That is a real cost: `elementByDataKey` is a small piece of
imperative traversal living in the contract because the alternative is three copies of it.

Comparison is a linear scan where a selector is an indexed lookup. On a chip strip — tens of
elements, on a gesture a person performs — this is not measurable, and it is the wrong trade to
optimise: the selector's speed is worth nothing when it raises.

`chosenKeyOrder` reads the controller's `counts` map, whose *iteration order* is now load-bearing.
That was already true and unstated; naming it is what makes it a property a check can defend rather
than an implementation detail three renderers happened to rely on.

## Alternatives rejected

**Escape the key before interpolating.** Works, and needs a second escape function — attribute values
and class names do not escape by the same rules, and this package already carries one for classes.
Two escapes to keep correct where zero will do.

**Require keys to be selector-safe.** Would mean the key derivation stops being structural, which
loses the property that makes it correct: two objects with different contents must be two keys.

**Let each renderer keep its own order derivation and test each.** This is what was in place. Three
derivations agreeing on every input anyone tried is precisely the state that hid the defect; the
agreement was never verified, only assumed, because no test used an input where they part ways.

## Verification

- `packages/widgets/test/a-key-that-is-not-a-selector.spec.mjs` asserts both halves: that the keys the
  contract produces really do break a selector, and that the door finds all of them. Asserting only
  the second would pass against a door nobody needed.
- `packages/lit/test/a-value-that-is-not-a-string.spec.mjs` and
  `packages/angular/src/lib/renderers/multiselect/a-value-that-is-not-a-string.spec.ts` carry object
  values through the gestures that index into the strip.
- Mutation: restoring `String(value)` at the key derivation turns the carry test red; restoring the
  interpolated selector at the removal-landing site turns the focus-landing test red. The second was
  worth doing — the raise happens on a later beat, inside a promise nobody awaits, so it surfaces as
  an unhandled rejection and *not* as a failure at the gesture. The check had to assert where the
  reading position lands, which is what a person experiences, rather than that nothing threw.

## Security and privacy

A value reaching a selector is an injection site in shape, and worth naming as one even though the
consequence here is a raise rather than a compromise: the selector is evaluated against the widget's
own subtree, and a crafted value can make a lookup match a different element within it or raise where
the caller expected a miss. Neither reads across a trust boundary — the values are the form's own,
supplied by the page that mounted it — but the general rule this closes is that data taken from a
document and put back into a query language is the same mistake wherever it appears. Comparison
removes the query language.
