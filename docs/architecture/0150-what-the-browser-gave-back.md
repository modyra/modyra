# ADR 0150: A restored value is adopted, and the form never disagrees with what is on screen

Status: Accepted

## Context

Somebody fills in a field, follows a link, and presses Back. Session history restoration is the
platform giving them their typing back — specified behaviour, implemented deliberately, and one of
the oldest fixes on the web.

It reaches a control this library built, and nothing tells the model. Measured, one field with an
initial value of `Ada`, typed `Grace`, away and Back:

| browser | the box showed | the model held | |
| --- | --- | --- | --- |
| Chromium | `Grace` | `Ada` | they disagree, silently |
| Firefox | `Ada` | `Ada` | agreed, and the typing is gone |
| WebKit | `Ada` | `Ada` | the same |

All three renderers, and four kinds confirmed: text, textarea, number, checkbox.

**The restore happens in all three.** What differs is *when*, relative to the controls being built:

| | markup control on arrival | control built by script |
| --- | --- | --- |
| Chromium | `Ada` — restores after | `Grace` — restored |
| Firefox | `Grace` — restores before | `Ada` — never touched |
| WebKit | `Grace` — restores before | `Ada` — never touched |

So Firefox and WebKit showing `Ada` is not a policy. It is a restore that landed before the controls
existed. Counting them as two votes for "a fresh start" counts an accident as an opinion.

`pageshow.persisted` is `false`: this is not the back/forward cache, it is form state restoration.
The restore fires **no `input` and no `change`** — measured in all three. A form cannot be told about
it; it has to look.

**The state to fear is the first row.** A person is shown one value, presses submit, and another is
sent, with no moment at which they could have noticed — every part of the page is individually
correct. Losing the typing is a loss they can see and redo. This is a loss they cannot see at all,
and where a confirmation step exists it will show them the wrong value with the authority of a
review.

## Decision

**Where the browser restored a value, the form adopts it. Where it did not, nothing happens. The two
never disagree.**

`adoptHistoryRestore` in `@modyra/widgets` is the single implementation, bound by each renderer where
it already binds the form's reset.

**Which controls were restored is answered by difference, because nothing reports it.** The
navigation type is checked first — anything other than `back_forward` returns immediately, so an
ordinary mount pays one string comparison. Then the value of every control under the root is
recorded as the controls are built, and compared a task later. A control whose value changed without
this library changing it was written to by the browser.

**Adoption is an `input` and a `change` on that control** — the door a person's own typing comes
through. The model hears about it the way it hears about everything else, and the field is marked
touched, which it was: they had typed there before they navigated away.

## Consequences

- **A form without a draft no longer disagrees with its own screen**, in any browser.
- **In Chromium the typing survives Back**; in the other two it does not, because there is nothing to
  adopt. That difference is the platform's, not this library's: where nothing was restored there is
  nothing to disagree about either.
- **`change` fires once per restored control after a history traversal.** A consumer counting change
  events, or acting on each one, sees them. This is the cost of using the ordinary door rather than
  writing to the model behind the renderer's back, and the ordinary door is what keeps every kind
  working without this code knowing what a kind is.
- **Fields adopted are marked touched**, so validation on them runs and their errors show. Correct —
  they had been typed in — and it means a person returning to a form can be met with errors that were
  already true when they left.
- **A snapshot of every control at mount**, held until the comparison runs. One map, one task, then
  released.
- **New public exports to keep stable**: `adoptHistoryRestore` and `MdyHistoryRestoreBinding`.

## Alternatives rejected

**Realign the box to the model instead — let the typing go, everywhere.** Consistent in all three
browsers and it closes the silent disagreement just as well. Rejected because it throws the typing
away *precisely where it was recoverable*, buying uniformity with the person's work. The uniformity
is also false comfort: it makes all three browsers lose something one of them had already saved.

**Do nothing in the runtime and document `draft`.** `draft` genuinely solves this — measured, with a
draft configured both Chromium and Firefox come back to `Grace`, box and model agreeing — and this
decision does not build a second persistence mechanism because of it. Rejected as the whole answer:
a form without a draft is the default, and the default may not be the one state a person cannot
detect.

**Turn `draft` on by default.** It would give every form the typing back in every browser. Rejected:
it writes a person's input to `localStorage` on a page that never asked for storage, which is a
privacy obligation taken on their behalf.

**Listen for the restore rather than compare.** There is nothing to listen to; the restore is silent
in all three browsers.

**Discard a restore that is old, or that came from far away.** Rejected on principle and on
mechanism. The browser already bounds session history and expires its caches, and it is the only
party with the information to make that call. An application adding its own age limit invents one the
person cannot see, predict or adjust — and their sense of *"I was in the middle of something"* has no
clock in it.

## Verification

- `packages/widgets/test/history-restore.spec.mjs` — seven cases: a restored control is reported, an
  untouched one is not, an ordinary navigation adopts nothing, a checkbox and a textarea behave like
  anything else, a removed control is not spoken to, cancelling stops the comparison, and only what
  moved is adopted. Mutating away the "only what changed" filter turns five of the seven red;
  mutating away the navigation check turns one red.
- Browser, three renderers × three browsers after a Back: nine of nine agree, and in Chromium they
  agree on the typed value.
- `npm run test:type-surface` classifies the two new exports as minor and holds them.

## Security and privacy

Nothing is persisted, and this decision deliberately does not start persisting anything — that is why
turning `draft` on by default was rejected. The value adopted is one the browser had already put on
the person's screen in their own session; adopting it moves it no further than it already was.

It narrows one real exposure: a form that submits a value the person cannot see is a form that can
send data they believe they replaced. Where the field held something from their account and they
changed it, the previous behaviour submitted the account's value while showing theirs.

The restore is per-profile and per-session-history and never crosses an origin; this code reads only
controls inside the root it was given.
