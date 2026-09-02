# ADR 0195: A list that arrives after the control is on screen

Status: Accepted

## Context

The select field controller offers `setOptions`, documented as the call for "a list that arrives
after the control is on screen" — the async load, the dependent field, the search result.

Three hosts wrap that controller, and they do not all make that call.

- The Lit and Angular adapters hold the controller for the life of the element and forward
  `setOptions` to it. The controller keeps everything else it holds — the panel, the active option,
  the query — and swaps the list underneath.
- The React hook takes the list as part of its configuration. A configuration whose comparable
  members changed is a different controller, so a new list builds a new controller, and a new
  controller starts closed.

Measured, in one run, in `packages/react/test/a-list-that-arrives-while-the-panel-is-up.test.mjs`:
with the list replaced through the controller the panel stays up; with the same list replaced as
configuration the panel shuts. Same person, same act, two answers.

Neither host is doing something careless. React's rule is that what a component renders is a
function of its props, and a hook that quietly kept a stale list while the parent passed a new one
would be the more surprising of the two. The divergence is the cost of that rule, not a slip.

## Decision

**The list is configuration in React and a call everywhere else, and a select in React closes when
its option list is replaced.**

`useMdySelectField` does not gain a `setOptions`. Adding one would put two owners on the same list —
the prop and the setter — and the question "which of the two won" has no answer a caller can predict.

The other hosts keep `setOptions`, and keep the panel open across it. A list arriving while the
person is looking at the panel must not close it there: the panel is the thing they are reading.

## Consequences

- A React consumer whose options load asynchronously while the panel is open sees the panel close.
  The mitigation is theirs and it is ordinary: do not swap the list while the control is open, or
  accept the close as the load's visible end.
- The three hosts no longer forward the same set of names, and that is now recorded rather than read
  as drift. A guard that demands they agree would be asserting something this record denies.
- `setOptions` stays on the controller. It is not dead: two of the three hosts call it, and it is the
  only route that preserves state across a list change.

## Alternatives rejected

- **Give the React hook a `setOptions`.** Two owners for one list, and the resulting order-dependence
  is invisible at the call site. Rejected on the same ground as the `onChange` the field controllers
  dropped: a second thing owning the value.
- **Rebuild the controller in the other hosts too, so all three close.** It equalises by making two
  good behaviours bad. A panel that closes because a list refreshed is a defect in Lit and Angular
  even if it is a consequence in React.
- **Preserve the panel across the React rebuild by carrying state into the new controller.** A new
  controller that inherits the old one's open panel, active option and query is the old controller
  with extra steps, and it reintroduces the staleness the rebuild exists to prevent.

## Verification

`packages/react/test/a-list-that-arrives-while-the-panel-is-up.test.mjs` runs both routes in one
file: the controller route asserts the panel survives `setOptions`, the React route asserts it does
not survive a list passed as configuration. Either half failing means a host changed sides without
this record moving.

The test carries its own bench check — it asserts that opening the panel repainted something before
it asserts that a list change closed it, because a bench that repaints on nothing reports every
panel as closed and every claim here as confirmed.

## Security and privacy

None. The decision concerns when a controller is rebuilt inside a host; no trust boundary, stored
value or transmitted data is touched. A rebuilt controller starts from the same handle the old one
read, so no value is disclosed or retained that was not already held by the form.
