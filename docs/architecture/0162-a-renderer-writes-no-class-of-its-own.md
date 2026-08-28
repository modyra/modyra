# ADR 0162: A renderer writes no class of its own

Status: Accepted

## Context

`@modyra/plain` wrote five classes the widget contract does not declare — `mdy-plain-form`,
`mdy-plain-colors`, `mdy-plain-datepicker`, `mdy-plain-daterange`, `mdy-plain-timepicker` — placed
beside the contract's own class on four of its eleven field renderers.

They began as hooks for a plain-only stylesheet. Commit `623f3fcf` folded that stylesheet into the
contract's vocabulary and deleted every rule that selected them. The rules went; the hooks stayed,
styled by nothing, on four kinds rather than all of them. A mark on some of the kinds is not a
convention.

They survived a month in a repository with a conformance gate that fails on `INVENTED_CLASS`, because
that gate takes an `adapterPrefix` option and plain passed `"mdy-plain-"` at five call sites. The
check skipped every class beginning with the prefix. **An undeclared class was not tolerated by
oversight; it was exempted by an option**, and the exemption was invisible from the gate's green
result.

Two things made the residue look load-bearing, and both were wrong:

- **Plain's own tests selected them.** `.mdy-plain-datepicker`, `.mdy-plain-daterange` and
  `.mdy-plain-timepicker` located a field's root in five tests. Removing the classes turned those
  five red, which reads as "something depended on this".
- **`datepicker` and `daterange` both render `mdy-datepicker`.** The two kinds are not distinguished
  by that class, so `mdy-plain-daterange` looked like the only way to tell them apart.

Both dissolve on measurement. The contract's `root` part already declares
`mdy-renderer--datepicker` for one and `mdy-renderer--daterange` for the other, and plain already
writes them: the distinguishing class was in the page the whole time. The tests were written against
the residue instead of the contract.

## Decision

**A renderer writes only classes the contract declares.** Where a renderer needs a class the contract
does not have, the contract gains it; the renderer does not invent one under its own prefix.

**Plain's conformance suites claim no `adapterPrefix` exemption.** All three renderers are now held to
the same `INVENTED_CLASS` check with no exemption between them.

**A conformance test selects by the contract's vocabulary, not by an adapter's.** A test that reaches
for an adapter-private class holds that adapter to itself; a test that reaches for the contract's
class is the same test for every renderer, and the one that would catch the next renderer inventing
its own.

The `adapterPrefix` option remains on `@modyra/widgets/testing` with no caller. It is the mechanism
that hid this, and it is the next thing to remove.

## Consequences

A renderer that genuinely needs to mark its output now has to change the contract to do it, and that
is more expensive than adding a prefixed class — deliberately. The cost is paid where the class is
declared, once, rather than by every consumer who cannot find it.

An out-of-repository stylesheet selecting `.mdy-plain-*` stops matching. Nothing in this repository
did — no stylesheet, no demo, no example, no end-to-end spec — and the classes were on four kinds out
of eleven, so anything written against them was already inconsistent. Recorded as a breaking change
to rendered output.

Plain's tests are now stricter than they were: with the exemption gone, any class outside the
contract fails the conformance suite for plain as it already did for lit and angular.

`datepicker` and `daterange` sharing `mdy-datepicker` remains. It is legitimate — a daterange *is*
drawn as a calendar and inherits its anatomy — and the contract already provides the discriminating
class alongside it. This ADR does not change it, and notes it because it is what made the residue
look necessary.

## Alternatives rejected

**Declare the five classes in a plain-owned vocabulary.** Written and discarded. It reads as closing
the gap — the classes get a name, a door and a check — but it re-legitimises exactly what `623f3fcf`
dismantled, and it would have made permanent a mark that exists on four kinds out of eleven. The
question "why is it on these four?" has no answer, which is the sign that the answer is "it should be
on none".

**Declare them in the widget contract.** The contract is what every renderer implements. A class
saying *which* renderer produced the DOM would oblige the contract to know its own derivations, which
inverts the dependency direction the repository holds everywhere else.

**Extend the marks to all eleven renderers, making the convention consistent.** Consistent and
useless: eleven classes nothing selects, and the conformance exemption kept forever to permit them.

**Remove the `adapterPrefix` option outright.** It is published on `@modyra/widgets/testing`, and an
out-of-repository renderer may be passing it. Removing an option with nothing replacing it is a
decision this change does not need to take: dropping every caller makes it inert, and its removal can
be decided on its own evidence.

## Verification

`npm run test:plain` and `npm run test:plain-contract`, with the `adapterPrefix` exemption removed
from all five call sites — plain's conformance suite now fails on any class outside the contract.

Falsified by planting the residue back: adding `mdy-plain-timepicker` beside `mdy-timepicker` makes
`packages/plain/test/contract.test.mjs` fail with `mdy-plain-timepicker is not part of the timepicker
contract` / `INVENTED_CLASS:root`. The gate catches it without help from the test written for this
change.

`packages/plain/test/renderer-marks.test.mjs` holds the absence in the page rather than in the
source. A grep proves the literal left the file it was written in; only mounting a form proves no
other path puts it back, and the class was placed by four separate renderers to begin with.

## Security and privacy

None. The classes carried no data and were never read; nothing selected them, so no rendering or
behaviour depended on their presence. Removing them changes which class names appear in the DOM and
nothing else.
