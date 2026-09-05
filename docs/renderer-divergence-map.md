# Where renderers diverge, and what the contract said about it

Measured 2026-09-04 in a real browser, on the four renderers the browser tier drives — Plain, Lit,
Vue and Angular — putting the same document through each and reading what a person would get.

`contract-gaps.md` says what is wrong with the widget contract. This says something narrower and
more uncomfortable: **for each place where renderers behaved differently, what the contract had
already said, and why saying it was not enough.**

Every divergence here was found by the browser tier or by a comparative probe, never by reading
source. The contract column, in contrast, is read from source with the name quoted, so a reader can
disagree with it in one search.

## The four answers

| | what it means |
| --- | --- |
| **Declares and guards** | a divergence cannot happen in silence: something fails |
| **Declares, nothing enforces** | the name exists, the rule is written, no check fails when it is broken |
| **Advisory** | prose that recommends, with no shape that could fail |
| **Silent** | the question has no answer in the contract at all |

## What "status" asserts

Each row below carries a **status**, and the word is defined here because a status column maintained
by hand becomes the next undated number — a document that describes yesterday with yesterday's
authority.

| status | what it asserts, and how a reader checks it |
| --- | --- |
| **guarded** | the row names a claim, and **a red exists that falls if the repair is removed**. Not "someone fixed it": a check that goes red again when the fix goes away. |
| **open** | the divergence is still measurable, or the guard does not exist yet |

**Two grades of evidence for `guarded`, and a reader is owed the difference.** The strong one is a
*mutation*: the repair is removed and the check is watched going red. The ordinary one is *history*:
the check was red, the repair landed, the check closed in a measured run — which establishes the same
dependency in the direction it actually happened. The rows below rest on history; none has been
re-mutated, and that is stated rather than implied.

A row moves to **guarded** in the same commit that makes it true. If nobody can point at the red that
would fall, the row is **open**, whatever the code now does.

**When this map was written, not one row was "declares and guards".** That was the finding: every
divergence a person could feel was either declared with nothing to enforce it, or never asked. Three
rows have since been promoted — each with a red that falls if its repair is removed — and the rows
that remain say so in their status.

---

## The central hole: a renderer chooses which questions it is asked

**Family**: the attributes a widget writes do not follow the state it is in.
**Felt as**: a field that has become invalid does not say so; a switch that is on is painted as
though nobody may change it; a read-only field does not announce itself.
**Contract**: **declares, nothing enforces.**

The kit declares the states and what each should look like — `MDY_CANONICAL_DISABLED`,
`MDY_CANONICAL_INVALID`, `MDY_CANONICAL_OPEN`, `MDY_CANONICAL_AFTER_ESCAPE` — and
`collectStateMatrix` mounts a fixture and drives it into each one. The declaration is there and it is
good.

**What is not there is a consequence.** A config's `drive(state)` returns a boolean, and returning
`false` costs nothing:

```js
// packages/vue/conformance.config.mjs
drive: (state) => {
  if (state !== "open") return false;
  …
}
```

Every state but one, declined. In `state-matrix.ts` a declined pair goes to `undrivable`, and in
`packages/widgets/bin/modyra-conformance.mjs` `undrivable` is passed in the **notes** position of
`record(…)`, not the findings position. The exit code is `failed === 0 && !measuredNothing ? 0 : 1`,
and `failed` counts findings. So a renderer that declines every state exits **0** and earns the
verdict `CONFORMANT WHERE CHECKED`.

**Vue was conformant all day while five of its components never redrew after mount.** Not because the
kit lacked a section, but because the subject was allowed to decline the section — and declining is
free, silent in the exit code, and visible only as a note nobody has to read.

**The shape of the resolution** (esecutore's to design): a declined state is a fact about the
renderer, not an absence of a question. Either it fails, or it is declared *in advance* — a renderer
saying "I cannot be driven into `disabled` and here is why" is an exemption with a reason, which is
the form every other exemption in this repository now carries.

---

## Declares, nothing enforces

### Bounds and properties never reach the control

**Status: guarded** — `VAL-004`, `UI-011`. The bounds reach the control now, and the browser tier closed the reds that measured it; removing the wiring puts them back.


**Felt as**: a slider the document bounds to 10–20 went to **0** on Home and **100** on End, and one
arrow moved it by 1 where the document said 5. The form held values the document declares impossible.
`placeholder`, `ariaLabel` and `step` never arrived either.

**Contract**: `nativeConstraintAttributes` is exported from `@modyra/widgets` — the door that turns a
field's declared bounds into the attributes a native control wears. Vue's components did not call it.
Nothing failed.

**Why it survived where everyone looks**: an `<input type="range">` defaults to 0–100 step 1. A demo
slider is almost always 0–100, so the defaults coincide with the declaration and the defect is
**invisible exactly where it is most looked at**. It takes a range unlike the default to see it.

### Focus after a field is taken out of play

**Status: guarded** — `A11Y-005`. `keepKeyboardInPlay` is called by every renderer, and the spec that measures where the keyboard lands falls if a renderer stops calling it.


**Felt as**: a person typing in a field that a rule disables is left with the keyboard nowhere; the
next Tab starts from the top of the document.

**Contract**: `keepKeyboardInPlay` is exported from `@modyra/widgets` and called by Plain
(`text-field.ts`), Lit (`base.ts`) and Angular (`control.directive.ts`). **Vue called it from
nowhere.** The door existed; calling it was on trust.

**Measured, and it decided the repair**: all four renderers genuinely disable the control — `disabled`
property *and* attribute, plus `aria-disabled` — so the browser really blurs in all four. Plain, Lit
and Angular then put focus on the **next field**. That is a decision taken after the blur, not a
focus never lost, which is what made copying it legitimate rather than an imitation of an agreement
reached for different reasons.

### Which element opens a popup

**Status: guarded** — `A11Y-008`, `UI-010`. The door the contract names first opens, and the reds that measured it closed on `c9ba61ef`.


**Felt as**: pressing a date field does nothing; only the small button beside it opens the calendar.

**Contract**: `MDY_POPUP_OPENERS` declares, per kind, `opener: "control"` for `datepicker` and
`timepicker`, with `alsoOpensFrom: "toggle"` as the second door. The declaration names the primary
opener. Nothing checked that the primary one works.

### A panel shown before anyone opened it

**Status: open** — and still **Probable**: it is not established whether the canonical at-rest reading covers panel visibility or whether the fixture never exposed the panel to it. Nothing here has been promoted.


**Felt as**: a Vue select displayed its option list on mount, while its trigger reported
`aria-expanded="false"` — shown open, declared shut.

**Contract**: `MDY_CANONICAL_AT_REST` declares what a widget looks like at rest. The at-rest section
did not catch this. **Marked Probable, not Observed**: I did not determine whether the canonical
at-rest reading includes panel visibility or whether Vue's fixture never exposed the panel to it, and
the difference decides where the repair goes.

---

## Advisory

### When a door is called, not whether

**Status: open** — no check reads a call's position in time. The vue case below is **Observed**
(measured on the equivalence bench 2026-09-05, 17 rows); that Lit and Angular are safe is **read from source**,
from where their calls sit, and has not been driven.

**Felt as**: a disabled field on a page nobody has touched pulls the keyboard into itself. Not a
field the person was standing in — one they never visited.

**Contract**: **advisory**, and the prose is *correct*. `keepKeyboardInPlay` says in its own doc
comment: *"Call it before taking the control out of play"*, and `afterBlur` explains what the flag
costs when it is wrong — *"'nowhere' matches a field nobody was ever standing in, and putting focus
on such a widget's root moves the keyboard to a control the person never visited."* That sentence
describes the vue defect exactly, and it was written before the defect existed.

**What makes this its own species**: every other advisory row here is prose nobody read. This one was
read, and still bought nothing — because **`afterBlur: true` is a claim about where the caller stands
in time, and a literal cannot carry a location.**

Three renderers pass the identical value:

| renderer | where the call sits | is `true` honest? |
| --- | --- | --- |
| Lit | inside the blur listener, one microtask later | yes — the handler *is* the evidence a blur happened |
| Angular | inside `onFocusLost`, `relatedTarget === null` | yes — same |
| Vue | inside a render effect | **no** — nothing had blurred |

Plain passes no options at all, and is also correct: it calls *before* disabling, so the control is
still focused and `afterBlur` is never consulted. Four renderers, three shapes, one rule — and the
rule is satisfied by **position**, which the argument list cannot express. Vue's repair recovers the
evidence a blur handler gets for free, by sampling *"was the keyboard here?"* before the change.

The contract already demonstrates the right shape in its own code — `field-teardown.ts` tests `held`
first and only then calls — so the library both states the rule and follows it, while requiring
neither.

**What closes it, decided**: both, and the signature now rather than on a condition.

The **guard** is a kit section that drives a widget nobody has touched and asserts the keyboard stays
out of it. It tests the *felt symptom* rather than the shape, so it catches whichever renderer gets
this wrong and however it gets it wrong.

The **repair** is a signature that cannot be called from the wrong moment: the sampled answer *as*
the argument, rather than a boolean asserting that someone sampled it. `afterBlur` goes with it.

This was first decided the other way — signature only *if* the guard later caught a second renderer —
and that condition is recorded here because it was wrong in an instructive way. **It could not fire on
its own.** A behavioural guard sees a keyboard moved wrongly only from a renderer that also gets the
*position* wrong; Lit and Angular pass the identical literal and behave correctly precisely because
their position saves them. So "wait for a second case" resolves to "wait for the next defect" — which
is the prose option under another name, and prose is what let this one through.

---

## Silent

### Where focus goes after a panel closes

**Status: open** — `MDY_WIDGET_TRANSITIONS` promises `restoresFocus`, and no door performs it. The third species of closing is now contract (ADR 0206) and this one is not.


**Felt as**: Escape closes the panel and the keyboard is left outside the field; the next Tab restarts
from the top.

**Contract**: `focusPartOnOpen` declares where focus goes when a panel **opens**. For closing,
`MDY_WIDGET_TRANSITIONS` marks `restoresFocus` on Escape for six kinds — so a promise exists — but
there is no door that performs it the way `focusPartOnOpen` does for opening, and
`restoreFocusTrigger` is a mechanism no declaration binds to a kind. Half declared, unbuilt.

### What a renderer may decline to answer

**Status: open** — abstention is now visible per kind, which is what made the drive worth landing; but a declined state still costs nothing in the exit code.


**Contract**: silent, and this is the one that lets all the others hide. Nothing declares which
questions a renderer must be able to answer. `CONFORMANT WHERE CHECKED` is a verdict the kit can
reach with almost nothing checked, and its name is honest while its exit code is not.

---

## What this map does not claim

- **The pinned browser reds are not all classified here.** This maps the families behind the
  divergences a person can feel, which is what the directive asked for; the register orders the rest
  by severity. The count is deliberately not written here: a number in prose has no maintainer, and
  this one was already stale by twenty when it was noticed. `known-red-browser.json` is the figure.
- **One row is Probable** — the at-rest panel — and it is marked. Everything else was reproduced.
- **The contract column is read from source, not from a run.** A name quoted here exists; whether a
  check *would* have failed is stated only where I drove it.
- Angular is measured here through the browser tier, but its conformance suite runs elsewhere, so
  "conformant" for Angular means something different from the other three. That asymmetry is declared
  in `scripts/conformance-manifest.mjs` and is not a finding of this map.
