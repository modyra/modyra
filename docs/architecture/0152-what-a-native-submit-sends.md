# ADR 0152: A form built with these controls submits, and the payload carries the field's own names

Status: Accepted

## Context

A consumer puts these controls inside a `<form>` and gives the page a button that submits. Measured,
all three renderers:

```
submit → the page navigates away,  query = (empty)

input[text]      name=null  value="Ada"
input[number]    name=null  value="3"
input[checkbox]  name=null  value="on"

new URLSearchParams(new FormData(form)).toString()  →  ""
```

**No control wrote a `name`**, and a control without one is not serialised. The server received
nothing, and nothing said so.

Two kinds were the exception and were wrong differently: `radio` and `segmented` did carry a name,
and it was the **scoped widget id** — `f3a9-colour` rather than `colour` — because in HTML the name
is what groups a set of radios, and without a scope two forms on one page merge their groups.

## The fact that shapes everything: the name is per part, not per field

Measured kind by kind, every `input`/`select`/`textarea` in the subtree against the model's value.
Four classes, and only one is simple:

| | |
| --- | --- |
| **one control, and it is the value** | text, email, password, textarea, number, slider, datepicker, timepicker, file |
| **many controls, one shared name** | radio, segmented — this is how HTML expresses one choice |
| **many controls, one value between them** | daterange (two dates), colors (a picker and a hex box) |
| **no form control at all** | select, multiselect |

Writing the path onto every input in a subtree gets three of the four wrong: it sends a timepicker's
hour and minute alongside the time, sends a daterange's two ends under one key, and sends the popup's
filter box — a control that holds no value and exists only while the popup is open.

## Decision

**Every kind declares how its value is submitted**, in `submission.ts`, one of four shapes. The
declaration names the part, so a kind that gains a control does not silently gain a key.

**The key is the field's path.** Not the widget id: the id carries a per-form scope so two forms on
one page do not collide, and a scope in a payload is a key the receiving end never asked for.

**Grouping is by form owner *and* name**, measured identical in Chromium, Firefox and WebKit — two
`<form>`s each holding `name="colour"` are two independent groups, and a group with no owner does not
merge with one that has an owner either. So inside a form the path is both correct to submit and safe
to group by. **Outside every form the two sets do merge**, and there a native submit sends nothing at
all, so the name has no receiving end and is only a grouping key. `groupSubmitName` returns the path
when there is a form around the control and the scoped id when there is not: the scope keeps the job
it was added for and loses the one it was never meant to have.

**A boolean says what it means.** An unchecked box is *absent* from a payload — the rule — so `false`
and "this field was never sent" would arrive identical; and a checked box with no `value` sends the
string `on`, which describes the box rather than the answer. So the control carries the model's value
and a hidden companion carries `false` under the same key. **The companion goes quiet while the box
is ticked**, so the payload carries one key either way rather than two — `ok=true` or `ok=false`,
never both. The common construction puts the companion first and lets the later value win; switching
it off instead needs no convention at the receiving end, and it frees the companion to sit *after*
the control. Both are disabled with the field, because a disabled control is left out of the payload
entirely and a companion still sending `false` would answer a question the field was not asking.

**Where several controls carry one value, the contract decides which one is named and clears the
rest.** `applySubmissionNames` reads the classes the contract declares for each part — the one
description all three renderers already honour — and removes the name from every control the shape
does not name. That second half is load-bearing: a colour's native picker and a range's second end
both inherit a name from the shared control projection, and two controls under one key send the value
twice, of which `FormData.get` keeps the first without an error.

**The two kinds with no control get hidden inputs, and only those two.** `syncSubmitValues` keeps
them in step with the value: one per value, in order, because a multiselect joined into one key loses
both the order and the multiplicity that the field exists to carry. They are marked with an attribute
rather than declared as a part — nothing about them is a theme's business, and an element nobody can
see should not have to satisfy an anatomy that exists to describe what people perceive.

## Consequences

- **A form submits.** Ten of the fourteen kinds measured send their value, identically in all three
  renderers, where before all three sent nothing.
- **`radio` and `segmented` change what they send** — `colour=b` where they sent `f3a9-colour=b`. A
  consumer parsing the old key has to change; nobody could have been relying on it deliberately.
- **The DOM carries a second copy of the value for `select` and `multiselect`.** This is the defect
  shape this repository has found four times, and it is here because there is no alternative: an
  input is the only thing a form serialises. It is confined to the two kinds that need it.
- **A field can hold more inputs than it used to**, and that changes what a selector by position
  finds. The hidden inputs are placed **after** the visible control so `querySelector("input")` and
  `.first()` still land on the control a person can see — but `querySelectorAll("input")[2]` may be a
  different element than before. Measured, not predicted: six carefully written specs in the battle
  suite broke this way within an hour of the first placement, which put the companion first. One of
  them read a whole renderer as mute because focus had been put on an element that cannot take it.
  `input:not([type="hidden"])` is the selector that survives.
- **A control mounted outside a form keeps the scoped name**, so a group moved into a form after
  mount submits under the scoped key until it is redrawn. Declared rather than fixed: the renderers
  recompute it on every render, so the window is one paint wide.

## Alternatives rejected

**One hidden input per field, for every kind.** Uniform, one mechanism to test, no per-kind cases.
Rejected because it puts a second copy of every value in the DOM — the defect shape above — to avoid
per-kind knowledge the contract already has to carry for other reasons.

**Leave `select` and `multiselect` out.** The smallest batch: nine kinds work, two do not. Rejected
because a mixed form then reaches the server half-filled with nothing saying so, which is the same
silent disagreement ADR 0150 exists to close, moved to the server.

**The scoped id as the key everywhere.** No grouping regression is possible and the two kinds that
already had a name would not change. Rejected: the receiving end gets a key generated from the form's
field signature — stable across reloads, unreadable to whoever writes the backend, and *changed by
adding a field*, which would rename every other key in the form.

**`autocomplete` alongside the name.** What a password manager and address autofill need. Deferred,
not rejected: the name alone is what serialisation requires, measured, and `autocomplete` is a second
question with a taxonomy of its own.

## Verification

- `packages/widgets/test/submission.spec.mjs` — seven cases against the table rather than a renderer:
  every kind declares a shape, every part it names exists, the key carries no scope, a range's two
  ends are distinguishable, a boolean's companion shares its key, and the two kinds with no control
  name no part.
- Browser, three renderers, one form each: **thirteen of the fourteen kinds measured agree and are
  non-empty**, including the four classes that fail differently — `radio` sends one key, `daterange`
  two, `multiselect` one per value in order, a boolean always present.
- `pnpm run test:contracts` 27/27 · widgets 728 · plain 263 · lit 204 · angular 379.

**One kind still disagrees, and it is not about the name.** `datepicker` sends `2026-01-02` from
plain and Lit and **`01/02/2026` from Angular** — the text the box shows rather than the value the
model holds. The name is right in all three; what differs is what the control's `value` was already
carrying, which nothing had ever read. Naming it made a divergence visible that predates this batch,
and it belongs to whatever decides a datepicker's control value, not here.

## Security and privacy

This makes a form send data it previously did not send at all, which is the point and also the risk
worth naming: a field a consumer believed inert because nothing arrived is now serialised. Two things
bound it. A **disabled** control is left out of the payload entirely, in the platform's own terms, and
the hidden inputs follow the same rule rather than routing around it. And the key is the field's own
path, so nothing is sent under a name the consumer did not declare — no widget ids, no bookkeeping,
nothing a renderer invented.

`password` now serialises like any other text field, which is what a form is for; nothing conceals it
beyond what the platform already does, and a page that must not send it should not put it in a form.
