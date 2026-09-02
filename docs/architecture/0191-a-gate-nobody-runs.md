# ADR 0191: A gate nobody runs

Status: Accepted

## Context

`@modyra/widgets` publishes a conformance kit — the executable form of the claim that a renderer can
be checked against the contract from outside. It has a Node half and a browser half, and the browser
half exists because two of its sections cannot be answered anywhere else: whether a widget opens from
the keyboard, and whether every operable element has an accessible name. The Node run reports both as
*not established*, so a green Node verdict says nothing about them.

`test:conformance-browser` was in `package.json` and in no workflow. Nothing ran it.

Run against `plain`, it reported **eleven findings**: six keyboard ("the widget did not open" on
multiselect and colors) and five accessibility ("input has no accessible name" on checkbox, toggle,
select, multiselect, datepicker). Read at face value that is a renderer failing its own contract in
the two dimensions nothing else covers, and it is the reason the release was held.

All eleven were the kit's, and each cause is a measurement rather than a reading:

- **The nameless probe counted `<input type="hidden">`.** Its operability pattern matches a bare
  `input`, and its exclusions cover `aria-hidden` and the `hidden` *attribute* — not a hidden *type*.
  The tally names them: `1x checkbox|input type=hidden|0x0`, `1x toggle|…`, `12x multiselect|…`. A
  hidden input has no accessible name because it is not exposed, and asking for one is asking the
  wrong question of the right element.
- **`.mdy-multiselect__search-btn` matches nothing.** The opener search fell through to the generic
  `"input, select, textarea, button"` and pressed keys at whatever that found first. Focused on the
  real `.mdy-multiselect__trigger`, ArrowDown opens: `aria-expanded false -> true`.
- **`.mdy-colors__toggle-area` is a `<span>` with no tabindex.** `focus()` on it leaves focus on
  `body` — `fuoco atterrato: false (su body.)` — so the key went nowhere. Focused on
  `.mdy-colors__primary-picker`, both `Enter` and `Space` open.

The third cause is the one worth generalising: **the kit called `focus()` and assumed it landed.** A
press that goes nowhere and a widget that ignores a press produce the same report.

## Decision

**The kit asserts its own preconditions, and the command runs in CI.**

The nameless probe skips `input[type=hidden]`, the two opener lists name elements that exist, and
focus is *checked* after it is requested rather than assumed — a candidate that does not take focus
is not the opener, and the search continues instead of pressing keys into `body`.

`test:conformance-browser` runs on `main`, after the browser smoke step because that step installs
the browsers this needs.

**The eleven findings are adjudicated instrument, zero product.** They do not block 3.0.0.

## Consequences

`plain` reports `CONFORMANT · 17 kind(s) · 10 of 10 section(s) run`, and the keyboard section went
from "2 unreachable" to `26 open/cancel binding(s) pressed, 0 unreachable`. Two of the three repairs
made the kit *reach* things it had been silently missing, so this is more coverage, not less.

The kit is published: these repairs change what a consumer's renderer is asked. A renderer that was
passing because its opener was never found may now be measured for the first time. That is the
correction working, and it is a behaviour change on a published surface — the changeset says so.

`71 binding(s) not asserted here` remains, and that number is the honest limit of the keyboard
section: it presses open and cancel, and reports the rest as unasserted rather than as passing.

Three kinds are still `not reachable in the session`. The accessibility section says so by count
rather than omitting them, which is the property that let this be diagnosed at all.

## Alternatives rejected

**Read the eleven as product and hand the kinds to the renderer's owner.** This was the default and
it was wrong in every one of the eleven. What refuted it is cheap and was available from the start:
before believing a finding, assert that the check performed its act — that focus landed, that the
element matched. Two of the three causes are visible in one line of output each.

**Fix the findings by relaxing the probe** — excluding the kinds that reported, or dropping the
accessibility section for inputs. It would produce the same green from a kit that had stopped asking.

**Leave the command out of CI and run it by hand before a release.** That is the arrangement that
produced this: the command existed, and the eleven wrong findings survived for as long as nobody was
made to look at them.

## Verification

`pnpm run test:conformance-browser` — `CONFORMANT`, exit 0, in the exact form the workflow runs.

Each repair was planted back and observed to matter, which is the check that distinguishes a repair
from a coincidence:

- restoring the hidden-input population reproduces `checkbox: input has no accessible name`,
  `toggle: …`, `select: …`;
- restoring the assumed focus and the `<span>` opener reproduces
  `colors "Enter" when closed (open): the widget did not open` and the same for `" "`.

`pnpm run test:contracts` — `CONTRACT GATES CLEAN — 27 gate(s)`, so the repairs moved nothing else.

## Security and privacy

None. The kit drives a local demo page carrying invented data and reports on the DOM it finds. The
`input[type=hidden]` exclusion narrows what is *reported*, not what is exposed: a hidden input is
already outside the accessibility tree, which is why asking it for a name was the defect.
