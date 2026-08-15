# ADR 0061: A rule that says nothing says nothing

Status: Accepted

## Context

A rule returns the messages it wants shown, and no messages is an empty list. So this is what a person
writes:

```js
(value) => { if (value === "taken") return ["Already taken"]; }
```

There is no `else`, because there is nothing to say when the value is fine. It returns `undefined`,
and the engine read `.map` off it — inside the computed every read of `valid()` goes through.
`createForm` accepted the rule without a word and the first question thrown at the form threw back
`Cannot read properties of undefined (reading 'map')`, from a stack pointing at `field-record.ts`
while the mistake sat three files away in something the consumer wrote. After that the form could not
be asked anything: not its validity, not through a renderer, not by a submit.

The asynchronous half of the same idiom failed more quietly. `results.flat()` kept the `undefined`,
so every good value was marked invalid and the word **"undefined"** appeared next to the field.

[ADR 0057](0057-an-argument-is-refused-where-it-arrives.md) refused a wrong-shaped argument where it
arrived. A rule is the same kind of argument with one difference that decides this record: what it
answers cannot be known until it runs, so there is no door to refuse it at.

## Decision

**Nothing is nothing.** A rule returning `undefined` or `null` has no messages. It is the ordinary
case — the shape most people write — and reading it as "no errors" loses nothing, because a rule with
something to say says it.

**A bare string is one message.** A rule with one thing to say, said without the list around it,
reaches the person it was written for.

**Anything else becomes a message that says so.** A boolean, a number, an object, or a list holding
one, cannot be guessed at: passing the value silently would let a rule someone wrote stop applying
without a word, and that is the failure this record exists to prevent. The value is reported as
unchecked, and the development channel names the shape.

The same reading applies to a synchronous rule and to what an asynchronous one resolves with, because
it is one idiom written twice.

## Consequences

A rule that returned `false` used to make the form unreadable and now marks the field invalid with
`"This value could not be checked."` — developer-facing wording on a user-facing surface, the same
trade [ADR 0060](0060-a-refusal-reaches-somebody.md) takes. A product that wants its own words writes
a rule that returns them.

`false` is read as unreadable rather than as "invalid". Somebody meaning "invalid, no message" gets a
message they did not write. The alternative is guessing that `false` means invalid and `true` means
valid, which is a second rule vocabulary nobody declared.

A rule returning nothing no longer fails loudly, so a genuine mistake — a rule that meant to return a
list and fell off the end of a branch — now passes quietly. That is the price of supporting the idiom,
and it is bounded: the rule was not applying either way, and before this it took the whole form down
with it.

## Alternatives rejected

**Refuse at `field()` / `addValidators`.** There is nothing to inspect: a function's return value is
not knowable at the door, and the list-of-functions check ADR 0057 added is already there.

**Throw at the first bad answer, naming the rule.** It is the loudest option and it keeps the failure
mode this record removes — a form that cannot be read — while moving the message. A form that cannot
answer `valid()` cannot be rendered, and a rendering framework catching that has nowhere useful to
put it.

**Read `false` as invalid and `true` as valid.** It makes the boolean shapes work and introduces a
second way to answer a rule, which every consumer and every adapter would then have to know about.

## Verification

- `battle-tests/adversarial/validation/a-validator-that-returned-nothing.battle.test.mjs` — the four
  shapes, synchronous and asynchronous, with the explicit empty list as the control.
- `battle-tests/adversarial/validation/a-validator-that-breaks.battle.test.mjs` — a rule that throws,
  which is the neighbouring failure and is unchanged by this.
- `packages/core/test/` — the workspace suite, where every built-in validator returns a list and so
  passes through unchanged.

## Security and privacy

None directly. A message that is not a string is replaced rather than rendered, which closes one more
route by which an object reaches a page as `[object Object]` — the same route
[ADR 0060](0060-a-refusal-reaches-somebody.md) closed for a server's answer.
