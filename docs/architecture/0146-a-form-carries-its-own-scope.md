# ADR 0146: A form carries its own scope

Status: Accepted

Supersedes [ADR 0135](0135-an-id-is-a-function-of-the-document.md).

## Context

ADR 0135 made a widget's id a function of the field's path within its form's id scope, and its
amendment proved that the two properties a consumer wants cannot both be automatic:

```
stability      the id depends only on the document    ⇒ two live copies get one id
no collision   the id depends on the instance         ⇒ a second mount changes the id
```

It concluded that anything telling two mounts apart must come from outside the document, named two
candidates — the host, or the order of creation — took the host, and left the scope for the consumer
to supply. An unscoped collision became a documented hazard with a warning attached.

**The hazard is not theoretical and the warning is not where the harm is.** Measured on two forms
built from one document, in all three renderers:

```
plain     12 ids in form one, 12 in form two, 12 shared
lit        9                   9                9 shared
angular    5                   5                5 shared

form two   input[aria-describedby="n__description"]  →  form one's description, verbatim
```

`getElementById` returns the first match in the document, so a person on the second form using a
screen reader is read the first form's help text for a field they cannot see. Nothing throws, nothing
looks wrong, and the page answers a different question correctly. The warning that fires is a
`console.warn` — it reaches the author who happens to be looking at a console, and never the person
being read the wrong text.

**And there is a third source ADR 0135 did not consider.** It weighed the host and the mount counter
and found both wanting. But the widgets are bound to a **form**, and a form is an object with a
lifetime: it is neither the document nor the paint order, it exists in all three renderers, and every
widget bound to it can see it. That is where a scope can come from without any consumer knowing to
ask.

## Decision

**Every form carries an id scope, always, and every widget bound to it derives its ids within that
scope.** There is no unscoped case.

- The scope is held against the **form object** and reached from any handle, so every widget bound to
  one form derives the same scope whichever renderer draws it.
- **Its default value is a function of the document**: a short signature of the field paths the form
  holds. So a remount, and a client hydrating what a server rendered, arrive at the ids they had —
  which is ADR 0135's stability property, kept rather than traded.
- **Two forms built from the same document cannot be told apart by the document**, being identical by
  construction. The second is disambiguated where the renderer can see the page: plain owns its mount
  and its container is in the document, so it asks whether a live form already answers to that scope
  and takes the next one if so.
- **Lit and Angular cannot ask that question.** Their controls compute an id while rendering, before
  the element is in a document, so there is nothing to look at. For those two the twin case stays the
  consumer's to answer with `id-scope` / `[idScope]` — which is what ADR 0135 concluded and this
  record does not overturn.
- The renderers' existing doors win over the default everywhere: `idPrefix` on plain's mount,
  `id-scope` on a lit element, `[idScope]` on an Angular control.

**This costs the property ADR 0135 was written to establish**, and the trade is deliberate: an id
that is stable but wrong for the second form on the page is worth less than one that is right and has
to be declared to be predictable. The record it supersedes is what makes the cost legible.

## Consequences

**Every id changes.** `n` becomes `f1-n`, `n__label` becomes `f1-n__label`. An id is the only part of
a widget a consumer can name from outside, so this is a breaking change and ships as a major with a
migration: pass the scope you want, and the ids are the ones you already know with your scope in
front.

**A counter was the first implementation and is not what shipped.** `f1`, `f2` by creation order
answers the twin case in all three renderers and costs the remount: the same document mounted again
gets a different scope, so every recorded relationship in a snapshot, a hydrated page and a
consumer's own markup moves. The signature costs the opposite — it cannot separate twins where the
renderer cannot see the page — and the trade is taken that way round because a remount is something
every page does and two identical live forms are something a few do.

**Plain closes the twin case; the other two do not.** That asymmetry is a property of where the id is
computed, not a gap to be filled later: a renderer that mints an id before the element exists has
nothing to compare against. Stated here so that the kit's `Multi-instance isolation` section reporting
lit and Angular is read as the consumer's declaration being absent, not as the renderer being wrong.

The warning about a shared scope stays: supplying one identity for two forms is still a thing a
consumer can do, and it is still worth saying.

## Alternatives rejected

**Leave it as ADR 0135 decided.** The recorded position is defensible and was reached honestly; what
it did not weigh is that the person who pays is not the person who reads the warning.

**A registry that suffixes a colliding id at mount** — rejected by ADR 0135's amendment for a reason
that still holds: it makes the second form's ids depend on paint order, which is the counter's defect
in a corner. The form's own scope has the same order-dependence *once, at form creation*, where a
consumer can see it and override it, rather than per widget at paint time.

**Scope only when a collision is detected.** Keeps a single-form page's ids untouched, which is a real
advantage. Rejected because it makes the rule conditional on what else is on the page — the property
ADR 0135 was written to remove — and because two forms mounted in the other order swap which one keeps
the plain ids.

**Require the scope and refuse to mount without one.** Correct and unusable: it makes the first line
of every consumer's code a ceremony to satisfy a rule about a case they may never have.

## Verification

`battle-tests/browser/an-id-you-can-write-down-in-advance.spec.ts` asserts ADR 0135's shape and pins
the behaviour this record replaces: its first case mounts one declaration twice and requires identical
ids, which is exactly what a per-form scope stops. **It must be rewritten against this record, and
until it is, it is a known failure rather than a defect.** The case worth keeping is the scoped one —
two forms given different scopes share no id — which this record makes the only case there is.

The kit's `Multi-instance isolation` section mounts two instances and compares their ids. Plain passes
it without its config declaring anything, which is the new behaviour. Lit and Angular pass it by
declaring a scope in their configs — the kit's own contract, *"a renderer that can scope its ids says
how here"* — and that declaration is now the truthful statement of where the answer comes from for
those two, rather than a way of quieting the check.

## Security and privacy

An id collision leaks *content between two forms on one page* to assistive technology: the second
form's control is described by the first form's text. Where those forms hold different people's data —
two records open side by side — the description read aloud belongs to the other record. That is the
strongest reason this record exists, and it is why the fix is a default rather than an option a
careful consumer switches on.
