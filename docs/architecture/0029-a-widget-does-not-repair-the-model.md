# ADR 0029: A widget does not repair the model

Status: Accepted — amended 2026-08-10, see **Amendment: the rule belongs to the controller**

## Context

A select whose value is not among its options used to write `null` into the form. The reasoning was
local and looked sound: the widget cannot render what it has no option for, so it made the model
agree with what it could display.

The cost showed up where the value came from outside. An import carries the name of a category that
does not exist yet — that name is precisely what lets a person find the row and resolve it. The
select erased it the moment the control mounted, the row went blank, and the form then held nothing
where the user had been shown nothing. The failure is silent by construction: an empty control and
an empty model agree with each other, and the only party who knew the value existed was the file
that is no longer open.

The same shape recurs wherever a widget can render less than the model can hold: options that arrive
filtered, a value referring to something since deleted, a datalist narrowed by a search.

The reconciliation already had a mechanism for one case — a value arriving before its options were
loaded was set aside in component state and restored when they arrived. That mechanism does not
survive a remount, and it treats "the options have not loaded" and "the options refuse this value"
as different problems when the model's stake in both is identical.

## Decision

**A widget never writes to the model to make itself consistent.**

A value the widget cannot represent stays in the model. It is a value the form holds and the rules
can judge — `oneOf()` is how a select says a value is not one of its options — and the widget's job
is to make it visible: an unrecognised value renders as an option of its own, selected, labelled by
the value unless the application supplies a name for it.

What a widget may still repair is the *representation*: a value that matches an option loosely, as
one read from JSON does (`"1"` against `1`), takes the option's own value, so the model holds what
the list holds.

Nothing is added while the option list is empty. Options that have not loaded are not a list that
refuses the value, and a placeholder that appears on every load is noise.

## Consequences

A select can now show a value that is not one of its options, so an application that assumed the
control's displayed value was always a member of `options` has one more case to handle. That case
was always reachable — it just used to be reachable as *empty*.

Validity becomes the only thing that says a value is wrong, which means an application that wants
out-of-list values refused must say so with `oneOf()`. This is a real transfer of responsibility:
before, the widget refused silently; now nothing refuses unless a rule does.

A workaround an application built for this — merging the orphan value into the option list before
handing it to the control — becomes redundant. It is harmless: the value is already there, and the
helper adds nothing when the list contains it.

The `parkedValue` half of `MdySelectReconciliationState` no longer holds anything. It stays in the
shape so a value parked by an earlier version is still restored when its option arrives.

## Alternatives rejected

**Keep erasing, and warn in development.** A warning reaches the developer who has the console open,
not the user whose data is gone, and the erasure is exactly what the report of the defect described
as costing hours to trace.

**Park the value harder** — persist it outside the component so it survives a remount. This keeps
the model lying about what the form holds, and every consumer of the model (draft, submit, history)
sees the lie. The parked value was already the wrong shape of answer; making it more durable makes
the disagreement more durable.

**An input to opt into the new behaviour.** A default that destroys data is not a default worth
keeping under a flag, and the flag would exist forever to describe which version of the library the
application started with.

## Verification

- `packages/widgets/test/select-controller.spec.mjs` — reconciliation keeps an unrecognised value,
  normalises a loose match, and adds nothing to an empty list.
- The same case is asserted through all three renderers, because a rule of the contract that only one
  of them keeps is not a rule: `packages/angular/src/lib/renderers/select/orphan-value.spec.ts`,
  `packages/lit/test/orphan-select-value.test.mjs`,
  `packages/plain/test/orphan-select-value.test.mjs`.
- Mutation-tested: removing the synthetic option makes the Angular case fail on the assertion that
  the value is on screen, while the assertions about the model stay green — which is what separates
  the two halves of this decision.

Neither `contract:diff` nor `audit-type-surface.mjs` can see this change: the widget catalogue is
unchanged and no exported shape moved except the new helper. A behavioural decision of this kind is
guarded by its tests and by this record, and by nothing else.

## Security and privacy

None directly. One property is worth stating: the widget no longer writes a value the user did not
enter, so a rendered control cannot change what a form submits without a user action or an explicit
application call. That is strictly less authority than before, not more.

## Amendment: the rule belongs to the controller

**2026-08-10.** The record above was applied one renderer at a time, and that is why it was applied
unevenly: the single select carried it, the multiselect kept only the half that matters for data —
the value stayed and was submitted, and no chip stood for it, so a person saw one chip while the
form held two values and could not remove what they could not see.

The cause was the place, not the effort. A rule each renderer has to remember is a rule two of them
will forget, which is the same reasoning `dynamic-config.ts` gives for `searchable` being contract
data rather than a renderer input.

**The controllers decide the list a renderer paints.** `createSelectController` and
`createMultiselectFieldController` compute the declared options plus every held value those options
do not contain, and expose it as `state.options`; the indexes, the counts and the commands are built
from that list, so a chip standing for an unrecognised value exists and acts like any other. A
renderer paints `state.options` instead of the list it was handed.

There is deliberately **no hook for naming** such a value. It is labelled by itself, and an
application that wants a readable name supplies the option — at which point the value is not
unrecognised. A callback could not have crossed into a data-only document; supplying an option
works everywhere.

### Verification

- `packages/widgets/test/select-controller.spec.mjs` — the helpers and the identity rule.
- The same case asserted through all three renderers, for both widgets:
  `packages/plain/test/{orphan-select-value,multiselect-unrecognized}.test.mjs`,
  `packages/lit/test/{orphan-select-value,multiselect-unrecognized}.test.mjs`,
  `packages/angular/src/lib/renderers/{select/orphan-value,multiselect/unrecognized-value}.spec.ts`.
- The framework-free tests include the two cases that would betray an over-eager fix: a value that
  arrives **after** the widget was built gets its chip, and an empty option list adds nothing.
- Removing a value through the chip that stands for it is asserted, because showing it is only half
  the point.

### Security and privacy

The property this closes is worth naming: a form could submit a value the user was never shown. It
came from the application or the server rather than from a widget, and no widget writes it — but it
is now visible wherever it is held, which is the only honest state for a value that will be sent.
