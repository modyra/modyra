# ADR 0141: An id built from a value escapes it

Status: Accepted

## Context

A widget publishes ids for the parts it draws, and a consumer is invited to use them: an option's id
is what `aria-activedescendant` names, what a test reaches for, and what a stylesheet or a script
selects. An id that a consumer cannot address is a published handle that is not a handle.

Option ids were built by joining the field's name to the option's own value. A value is caller data —
it comes from a document, a fetch, a database column — and nothing constrains it to the characters a
CSS selector treats as ordinary. Values holding `#`, `.`, a space or a quotation mark produced ids
like `pick__option__hash#one` and `pick__option__dot.two`.

Every such id resolves through `getElementById`, and `aria-activedescendant` resolves it too, so
nothing an assistive technology does was broken. The failure is on the selector path only, and it is
not a near miss: `#` begins a new id selector, `.` begins a class selector, and a space begins a
descendant combinator, so a selector written from a published id silently matches the wrong element
or **throws** rather than returning nothing. Two of five sample values threw.

The pressure is therefore narrow and real: the library publishes handles, and for some caller data
those handles cannot be used in the way the library invites.

## Decision

**An id derived from caller data escapes that data into the character set an id may safely hold.**
Each byte outside `[A-Za-z0-9_-]` becomes `_` followed by its hexadecimal code: `hash#one` becomes
`hash_23one`, `dot.two` becomes `dot_2Etwo`, `space three` becomes `space_20three`.

The escape is total rather than selective — every character outside the safe set is encoded, not only
those that are known to break a selector today — so the rule does not have to be revisited when a
consumer reaches for the id through some path this record did not anticipate.

The id remains derived from the value. Two options with the same value in the same field still
collide, and that is a separate question about whether a field may offer one value twice.

## Consequences

An id is no longer readable as the value it came from. `pick__option__space_20three` is legible with
effort and `pick__option__quote_22four` is not, so anyone debugging by eye now decodes rather than
reads. This is the cost, and it is paid on every option whether or not its value needed escaping.

The mapping is one-way in practice. Nothing in the public surface decodes an id back to a value, and
nothing should: a consumer that needs the value should ask the form for it rather than parse an id.

**The library now has two answers to one class of problem.** Colour swatches are given ids by
position — `preset_0` — because a swatch's value is a colour and a colour is not a name. Options are
given escaped values. Both satisfy the property this record is about, and the difference is not
recorded anywhere as a deliberate one. A future reader finding both is owed either a reason or a
unification, and this record is the place the question is now visible rather than the place it is
answered.

## Alternatives rejected

**Ids by position, as colour swatches use.** `pick__option__0` is short, always safe, and needs no
escaping rule. It loses because an option's position is not stable: a list that is filtered, sorted,
or refetched renumbers every option after the first change, so an id captured before the change names
a different option after it. A swatch palette is a fixed set and does not have that problem, which is
why the same answer is right there and wrong here.

**A hash of the value.** Stable across reorderings and always safe. It loses to escaping on one point
only, and it is the point that decides it: a hash is unreadable in every case, while an escape is
unreadable only in the cases that needed escaping. Most values need none.

**Escaping at the point of use, leaving the id raw.** `CSS.escape` exists, and a consumer could be
told to call it. It loses because the failure is silent: a raw id works for most values and breaks for
some, so a consumer who omits the call ships something that passes every test written against ordinary
data. A handle that is safe only when used correctly, and fails quietly when it is not, is not a
handle the library should publish.

**Refusing values that cannot be embedded.** Rejected outright. The values are legitimate — a `#` in a
colour, a `.` in a version, a space in a label-shaped key — and a form that refuses a caller's data
over an internal naming rule has made its own convenience the caller's problem.

## Verification

`battle-tests/browser/an-id-a-selector-cannot-reach.spec.ts` — for every id a control publishes, the
spec resolves it through a selector built from that id. It passes in all three renderers. A renderer
that embedded a raw value would throw or mismatch on the `#`, `.`, space and quote cases the fixture
declares.

The spec never inspects the *content* of an id, only that it is reachable. That is deliberate: hash,
position and escaping all satisfy the sentence, and a check that pinned the escaped form would forbid
the alternatives above from ever being reconsidered.

**What is not guarded:** nothing asserts that the two id strategies in the library agree with each
other, because they do not. A future decision to unify them has no failing check to announce it.

## Security and privacy

An id derived from caller data places that data in the DOM, where it is visible to any script on the
page and to anything that serialises the document. Escaping does not change what is exposed — the
value was already in the id and is already in the control — but it does remove one injection shape:
a raw value containing markup-significant or selector-significant characters could previously steer a
consumer's `querySelector` to an element the consumer did not intend. Escaping makes the id inert with
respect to the selector grammar.

It is not a sanitiser and must not be relied on as one. A value that must not appear in the page must
not be an option value; that is a decision for the caller's document, and no naming rule here can
substitute for it.

## Amendment: the library was the other producer of an unreachable id

This record was written about **caller data** — an option's value, a row's key — and it named the
producer as the caller. There was a second producer, and it was this library.

A document that holds a collection names a nested field `rows.0.name`, and every renderer builds that
field's id from its path. The separator is a class selector to a browser:

```
querySelector("#form-rows.0.name")   throws — a class may not begin with a digit
```

Not a miss, an exception. So a consumer selecting a nested field by the id this contract published
gets a stack trace, and **the only input required is putting a form inside a form**. Nobody supplied a
strange value; the punctuation is the library's own.

It survived because the surrounding rules all looked satisfied. `assertUsableWidgetId` refuses a
host's id containing whitespace or the delimiter — and says so loudly — while the id the library then
minted for itself went through no such door. A rule that guards the front entrance and not the one the
house uses reads, from the code, exactly like a rule.

**The decision above is unchanged and now covers the path.** A path is data in the same sense a value
is: the document named it, refusing it would refuse the document, so it is spelled in the character
set an id may hold. `rows.0.name` becomes `rows_2E0_2Ename`, by the same total escape, through the
same function — which is exported for this, so the three renderers spell it one way rather than three.

### What it costs

**Every nested field's id changes.** A consumer's stylesheet, test or `aria-describedby` naming
`form-rows.0.name` names nothing after this. That is the breaking half, and it is the price of the
ids being reachable at all: the ones that change are exactly the ones that could not be selected.

A flat document is untouched — `name` escapes to `name` — so the common id stays readable and the
change reaches only the shape that was broken.

## Verification of the amendment

`packages/widgets/test/ids.spec.mjs` asserts the spelling, that what comes out matches the character
set a selector can carry, and that the encoding stays injective — two paths never landing on one id is
what stops an ARIA reference resolving into the wrong field.

Falsified by returning a path unescaped: red, and green again when it is put back.

**What is not checked**: that a renderer routes its path through this rather than happening to produce
a safe id. All three call the same function today; nothing fails if one stops.

## Security and privacy of the amendment

None. The escape changes how a name is spelled in an id, not what is stored, sent or shown.
