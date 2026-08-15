# ADR 0078: A widget announces the refusal it makes

Status: Accepted

Supersedes [ADR 0052](0052-a-widget-announces-only-the-states-it-has.md).

## Context

ADR 0052 removed `readonly` from twelve of the seventeen kinds: a checkbox, a chooser, a slider and a
range declared no read-only rendering, and the projections that announced one were corrected to say
nothing. Its reasoning was sound and is still the best argument in this area:

> HTML defines `readonly` for text-entry controls and **ignores it on a checkbox**, so a renderer
> binding it bound nothing and the box still toggled, while `aria-readonly="true"` told a
> screen-reader user it could not be changed.

An announcement with nothing behind it is worse than silence. That was true when it was written.

It is no longer the situation. Every kind's controller now asks `blocksValueChange(interactivity)`
before carrying out any intent — the boolean controller and the option controller do it in the same
line shape as the rest — so a read-only checkbox does not toggle, a read-only radio group does not
change, and a read-only select does not open its list to a choice. Measured in a page across all
seventeen kinds in both renderers: the value holds everywhere.

What is left is the opposite defect. Twelve kinds refuse every change and say nothing about it. The
control is focusable, it is submitted, it counts for validity, it looks exactly like an editable one,
and the only feedback is that nothing happens. `@modyra/lit`'s slider was worse still: it wrote
straight from the event, so it did not refuse either — a read-only rail that slid.

## Decision

**A widget announces read-only where its own controller refuses the change.** That is every kind with
a value. `MDY_WIDGET_STATE_SUPPORT` declares the state for sixteen of seventeen, and
`ARIA_STATE_CARRIERS` names the carrier per kind — the same element that carries `disabled`, because
it is the element a person operates.

**The native attribute only where the platform acts on it.** ADR 0052's finding survives intact and is
now stated as a rule: `readonly` is bound on a text-entry input and a textarea, and never on a range,
a checkbox, a colour, a file input or a `<select>`. Where HTML ignores it, the widget's own refusal is
what holds and ARIA is what says so. The conformance check no longer demands the attribute on an
element the platform ignores it for.

**`file` declares no read-only state**, and not because nothing implements it: the picker belongs to
the browser, its value is a `FileList` a page cannot write, and its element's role has no
`aria-readonly` to carry. What is true and expressible there is that the affordance is unavailable, so
a read-only file field disables its browse control while the field itself stays in play.

**Read-only is read from the form, not waited for from a host.** Three controllers kept `readonly` in a
local signal a host had to set through `setReadonly`, while reading `disabled` and `interactivity`
from the handle — so a field the form had marked read-only refused every change through one path and
reported itself editable through the other. They now derive it from the handle, with the host's
override still honoured.

## Consequences

**A screen reader announces twelve more kinds as read-only.** That is the point, and it is a change to
what users hear.

**A theme selecting on `[aria-readonly]` now matches kinds it did not.** ADR 0052 warned about the
mirror image of this when it removed the attribute; the same warning applies in reverse, with no
deprecation window.

**`MdyFieldShellFlags` gains an optional `readonly`.** A caller that omits it says nothing about
read-only, which is what every caller did before. Classified minor, and the shell asks the contract
before emitting anything, so a kind that declares no read-only state still gets none.

**Angular's renderers grew past their line budget.** Ten controls gained an ARIA attribute and four
gained the native one; `overrun` moved 408 → 422. The budget exists so growth is deliberate rather
than accidental, and this growth is the repair itself. It was re-recorded with the user's decision,
and it is meant to come back down.

**The ARIA is now the only signal on kinds HTML ignores the attribute for.** A consumer who filters
their DOM by the native `readonly` attribute will not find a read-only checkbox. There is no attribute
that would help them: the platform has none for it.

## Alternatives rejected

**Leave the tables as ADR 0052 set them and let the refusal stay silent.** It preserves a decision
whose premise has changed. The reason `aria-readonly` was wrong then was that nothing enforced it;
something enforces it now.

**Make the engine refuse `readonly` on those kinds instead**, so the contract becomes true again. It
removes a capability applications use — a value computed elsewhere, shown and submitted but not
editable — and `disabled` is not a substitute: a disabled field is not submitted and not validated.

**Announce read-only *and* bind the native attribute everywhere,** for symmetry with `disabled`. That
is exactly the pair ADR 0052 found: an attribute the platform drops, next to a claim it contradicts.

## Verification

- `battle-tests/browser/a-field-that-cannot-be-edited.spec.ts` — every kind, both renderers: a
  read-only field holds its value under a click and an arrow key, and says it is read-only. Sixteen of
  seventeen say it; `file` is the declared exception.
- `npm run test:conformance` — the state matrix drives `readonly` per kind in plain, lit and Angular,
  and fails on `STATE_ARIA_MISSING` or on a native attribute the platform would ignore.
- `packages/widgets/test/state.spec.mjs` — the projections announce it and bind the native half only
  where HTML honours it.
- `npm run test:angular` — Angular's own state matrix, all seventeen kinds.

## Security and privacy

None. Which ARIA attribute an existing control carries. Read-only fields were already submitted and
validated — ADR 0052 recorded that too — and nothing about what is sent changes here.
