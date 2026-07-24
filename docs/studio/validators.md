# Validators

Studio models four kinds of validator, all picked from dropdowns
populated by the real tree — never typed by hand, never a free-text path.

## Field validators

Select a field, open **Validation**: `required`, `email`, `min`, `max`,
`minLength`, `maxLength`, `pattern`, `oneOf`, `eachOneOf`. The list only
ever offers validators compatible with the field's value type — a number
field is never offered `pattern`, for instance.

## Array validators

An array node's own **Validation** section offers `min`/`max` (row
count), the same registry-driven compatibility rule as fields.

## Cross-field / form validators

Project-level rules that read more than one field — the **Form rules**
tab, not the Field tab, since they belong to the whole project rather
than one node. Build a condition from a template (equals, is empty, has
length at least, matches a pattern, …), or compose two leaf conditions
with **AND**/**OR**, or negate one with **NOT**. Every condition operand
is a field picked from the tree, never a typed path.

Each form validator has: a condition, a message, and an optional error
target (which field the error attaches to — defaults to the
dependencies). "At least one item in this array" is exactly this: a
`lengthAtLeast` condition on the array, attributed to the array itself.

## Server validators

A field's **Server validation** section (collapsed by default — open its
summary) turns on an async check: debounce, timeout, dependencies (other
fields whose changes re-trigger it), and a skip-when condition (most
commonly "skip while this field itself is empty"). Server checks are
always symbolic — Studio has no real backend, so enabling one creates a
typed, throwing **stub** function (`+ New stub`) you fill in yourself
wherever the exported code actually runs.

### Testing a server validator without a backend

The **Preview** tab runs a real `@modyra/core` form, and every
server-validated field there gets an inline **Server mock** selector:

- **Succeeds** — the default; resolves with no error after a short delay.
- **Fails** — always resolves with a simulated error message.
- **Network failure** — rejects instead of resolving, exercising the same
  code path a real dropped connection would (surfaces as a normal
  `async` error, not a crash).

Switching the mock rebuilds the live form so the new behavior applies
immediately.

## Diagnostics

The **Diagnostics** tab lists every issue the model and the Contract
compiler find, together — a broken reference, a select with no options,
an invalid regex, a sensitive-looking field left in draft persistence,
and anything a target can't represent (a server validator has no
equivalent in the portable Contract, for instance — reported as a
warning, not silently dropped). Where exactly one existing command
resolves an issue, a one-click fix button appears next to it; otherwise
only **Go to** (select the offending node) is offered.
