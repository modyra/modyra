# ADR 0113: A field name cannot break the value it is in

Status: Accepted

## Context

A document declared a field called `toString`. It passed every door: not a prototype key, no
whitespace, no id delimiter, no invisible character. The form built, and the value it produced then
carried `toString` as a **data property** — so `ToPrimitive` had nothing callable to reach:

    `${form.getValue()}`   →  TypeError: Cannot convert object to primitive value
    JSON.stringify(...)    →  ok

A template literal, `String(value)`, an `alert`, some spellings of `console.log`. The throw happens
**outside this library**, in the consumer's own code, with a message naming neither the field nor the
document that declared it. `JSON.stringify` is unaffected, which is why it went unseen: the
serialization path is the one everybody tries.

Measured across the inherited members a document might plausibly use, one name at a time:

    toString         template THREW · String() THREW · JSON ok
    valueOf          template ok([object Object]) · JSON ok
    hasOwnProperty   template ok · JSON ok
    isPrototypeOf    template ok · JSON ok
    constructor      already refused
    __proto__        already refused

It reaches all three published doors — `getValue`, `submitValue`, `getChanges` — and the typed door
too: `createForm({ toString: field("") })` written by hand throws identically.

## Decision

`toString` is not a name a field may have, at the document door and at the typed door alike.

**One name, not a list, and the reason is what keeps it one.** `ToPrimitive` tries `valueOf` first
and `toString` second. Shadowing `valueOf` alone changes nothing — the prototype's `toString` still
answers `[object Object]`. Shadowing both throws, but is unreachable once `toString` itself is
refused. `Symbol.toPrimitive` cannot be a field name at all, because a name is a string that must
pass `isIdSegment`. So the family is closed by the algorithm rather than collected as cases arrive.

It is refused for its own reason, with its own sentence: it is not a prototype key, and answering
"must not be a prototype key" about it would send a reader looking for pollution that is not there.

## Consequences

**This removes a capability.** A document that declares a field named `toString` parsed and rendered
before, and now loses that field with a diagnostic naming the reason. There is no migration to write
beyond renaming it, and no way to keep the name: the collision is with the language.

The two doors give the same verdict, which they did not have to — the typed door is code the author
can see, and one could argue they are entitled to the rope. Two doors answering the same question
differently is the defect shape this project keeps finding, so they answer together.

## Alternatives rejected

**A non-enumerable `Symbol.toPrimitive` on the produced value.** Measured, and everything enumerable
survives it: JSON, `Object.keys`, spread, `deepEqual`, `structuredClone` all unchanged. One
measurement decides against it — `String(structuredClone(value))` throws again. The guard repairs the
object the engine hands over and not the copy a consumer makes: a history clone, a JSON round trip, a
spread in a reducer. The defect reappears *further from its cause* than it is now, which is worse
than the same defect close to it. It is not a more conservative answer than refusal; it is refusal
postponed with the diagnosis made harder in the meantime.

**`Object.create(null)` for the produced value.** Makes `${value}` throw for **every** form rather
than for the ones with such a field: it pays the cost on everybody for a defect of a few.

**Leave it and document it.** The failure surfaces in someone else's code with a message that names
nothing of ours. A document is untrusted input, and this is the one door where a name decides whether
an ordinary operation on the result throws.

## Verification

- `battle-tests/adversarial/dynamic-contract/a-name-that-breaks-its-own-value.battle.test.mjs` — walks
  ten inherited names, asserts the value each produces converts and serializes, with `constructor`
  beside them as the control that the older guard still holds.
- `packages/core/test/` — the existing name-refusal cases, which pin that each reason is given for
  the defect it belongs to.

## Security and privacy

`SEC-001`. No data escapes and no boundary moves; the failure is availability, at the consumer's
expense. A document — from a CMS, a model, a server — chooses a field name, and an ordinary operation
on the resulting value throws in the host's code. A host that renders documents it did not write had
no way to see it coming: the name is valid by every published rule, and the serialization path most
code takes stays clean.
