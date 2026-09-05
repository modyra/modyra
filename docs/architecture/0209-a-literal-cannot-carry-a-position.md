# ADR 0209: A literal cannot carry a position

Status: Accepted (amended — see Verification)

## Context

`keepKeyboardInPlay` puts the keyboard somewhere when the control it was standing on leaves play.
Disabling a focused element blurs it — that is the platform — and what follows is this library's: the
person who was typing is on `<body>`, and their next Tab starts at the top of the document.

The door distinguishes two callers. One takes the control out of play itself and calls *before*, with
the keyboard still on the element. One only hears about it afterwards, when focus is already nowhere,
and says so by passing `afterBlur: true`. The distinction is necessary: without it, "focus is
nowhere" also matches a field nobody was ever standing in, and the door would move the keyboard into
a widget the person never visited.

**The rule was written down, and it was written down well.** The door's own documentation says *"Call
it before taking the control out of play"*, and `afterBlur`'s says exactly what goes wrong when the
flag is untrue — *"'nowhere' matches a field nobody was ever standing in, and putting focus on such a
widget's root moves the keyboard to a control the person never visited."* The library also follows
its own rule internally: `field-teardown.ts` tests whether the widget held the keyboard and only then
calls.

It was still got wrong, in the way the prose predicted, and the shape of the mistake is the reason
for this record. Four renderers, three shapes, all reading the same document:

| where the call sits | what it passes | true? |
| --- | --- | --- |
| inside a blur listener | `afterBlur: true` | yes — the handler *is* the evidence a blur happened |
| inside a focus-lost handler, `relatedTarget === null` | `afterBlur: true` | yes — same |
| before disabling, keyboard still on the control | nothing | yes — the flag is never consulted |
| inside a render effect | `afterBlur: true` | **no** — nothing had blurred |

The last row shipped. A disabled field on a page nobody had touched pulled the keyboard into itself.

The value passed is identical in three of those rows and correct in two of them. What separates them
is not the argument but **where the call stands in time**, and that is the finding:

> **`afterBlur: true` is a claim about where the caller stands in time, and a literal cannot carry a
> position.**

This is not the ordinary advisory failure, where prose exists and nobody reads it. The prose was
read. It was accurate, specific, and named this exact outcome before the outcome existed. It bought
nothing, because a correct sentence cannot make a boolean argument mean one thing at one call site
and another thing thirty lines away.

## Decision

**A door that depends on an observation made before it is called takes the observation, not an
assertion that someone made it.**

`keepKeyboardInPlay` receives the sampled answer to *"was the keyboard in this widget?"* — captured by
the caller before the change that takes the control out of play. The `afterBlur` option is removed in
the same window; it is the shape this record exists to retire, and leaving it beside its replacement
would preserve the misuse it permits.

A caller that cannot answer the question has not sampled, and the type says so at the call site
rather than at a person's keyboard.

**The kit gains a section that drives a widget nobody has touched and asserts the keyboard stays out
of it.** This is kept alongside the signature change rather than instead of it: the signature
prevents the misuse, the section catches the *symptom* however it is produced — including by a
mechanism nobody has anticipated, and in renderers not yet written.

## Consequences

- **This is a breaking change to a published door.** Every renderer that calls
  `keepKeyboardInPlay` changes its call site, and a downstream consumer calling it directly must too.
  It ships with a changeset stating the migration.
- The correct callers pay for the incorrect one. Two renderers whose calls sit inside blur handlers
  were already right, and they still rewrite their call sites. This is the cost of moving the
  guarantee from the caller's discipline into the door's signature, and it is the point rather than a
  side effect.
- **The library gives up a convenience it never should have offered**: the ability to assert a fact
  about the past instead of having observed it.
- The kit section is a new thing to maintain, and it constrains renderers not yet written — preact,
  solid, svelte will meet it before they meet this record.
- A caller with no way to sample is now blocked at compile time rather than silently wrong at
  runtime. That is intended, and it will surface as friction in a host whose lifecycle makes sampling
  awkward. The friction is the defect being reported early.

## Alternatives rejected

- **Leave it as documented advice.** This was the state of the world when the defect was written, and
  the documentation was already correct and specific. The option was live and it produced the defect;
  choosing it again is choosing the outcome again.
- **Add the kit section and leave the signature, changing it only if the section later catches a
  second renderer.** This was decided first and reversed. The condition **cannot fire on its own**: a
  behavioural section sees a keyboard moved wrongly only from a renderer that gets the *position*
  wrong too, and the renderers that pass the literal from a blur handler behave correctly precisely
  because their position saves them. "Wait for a second case" therefore resolves to "wait for the
  next defect" — the prose option under another name.
- **Keep `afterBlur` beside the new parameter for compatibility.** The old shape is what permits the
  claim-without-observation. Retaining it retains the defect and adds a second way to spell the same
  call, which drifts.
- **Detect the misuse statically** — flag a literal `true` passed from a context that is not a blur
  handler. "Is this a blur handler" is not a property source text carries reliably, so the check
  would be a heuristic guarding a correctness property, failing in both directions.

## Verification

- The kit section drives a widget that has never been focused, takes its control out of play, and
  asserts the keyboard did not move into it. It fails for any renderer that gets this wrong,
  whatever the mechanism, and it is the check that survives if the signature is later revisited.
- **Amendment, on implementation.** This section first claimed the compiler closes the misuse at
  every call site. It does not, and the correction matters more than the claim did.

  The parameter shipped as `heldTheKeyboard?: boolean` — an optional boolean, so
  `{ heldTheKeyboard: true }` written from a render effect still compiles, exactly as
  `{ afterBlur: true }` did. What changed is **legibility, not enforcement**: the name now states an
  observation, so a hardcoded `true` reads as a false statement of fact rather than as a flag being
  set. That is worth having and it is not a guard.

  Measured when this was written: all five call sites pass a variable and none passes a literal. That
  is the current state of this repository, not a property of the door — the renderers still to be
  written meet a signature that accepts the assertion.

  **What actually guards this is the kit section**, and it is mutation-proven rather than argued: with
  the sampling defect put back into one renderer, the section went red across every kind of that
  renderer and stayed green on the other three. Red everywhere would have meant the section measures
  itself.

  The enforcing option remains open and is deliberately not taken here: a required parameter, or a
  type only a real observation can produce. It is recorded so a reader who needs enforcement knows it
  was identified and deferred, rather than believing it was achieved.
- `npm run test:type-surface` classifies the removal; the changeset carries the migration.

**What remains unguarded, stated rather than implied**: that renderers *currently* correct are
correct is read from the position of their call sites, not driven. The kit section closes this the
moment it lands, and until then this record rests on a source reading for those rows and on a
measured browser run for the row that failed.

## Security and privacy

No trust boundary, no data at rest or in transit, and nothing an attacker gains directly.

The impact is on interface integrity, which is worth stating rather than dismissing: moving the
keyboard into a widget a person never visited relocates their point of interaction without their
having acted. For someone navigating by keyboard or by screen reader — who cannot see where focus
went — the consequence is that the next thing they type or activate is not the thing they believed
they were in. That is an input-integrity failure, and it falls hardest on the users least able to
detect it.
