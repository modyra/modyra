# ADR 0216: A restored value is the option it copies

Status: Accepted

## Context

A field that offers options is asked one question in three places: whether a value is one of its
options. The places answered it with three rules.

- The widgets' `sameChoice` is loose between primitives (`"2"` is the choice `2`) and compares objects
  by their structural key, so a copy of an object option, with its keys in any order, is that option.
- Core's `oneOf` validator compares by strict deep equality, independent of key order, and refuses
  `"2"` for `2`.
- Core's draft restore compared objects by their JSON text, so the same object with its keys in
  another order was refused and dropped as a hostile value.

The select controller also indexed option values by identity. A value that comes back from a draft,
a refetch or an import is a copy, not the option object the list was built from. It selected nothing,
and the list showed nothing chosen while the model held a value.

TypeSafe was asked which single rule to adopt. It chose (at 37% confidence) to keep `sameChoice` for
what a person sees and the validator strict.

## Decision

A widget finds the option a value is by `sameChoice`. The selection the controller reports is the
option's own value, never the copy that arrived. So what a person sees chosen is an option, and what
the field reports is a value the strict validator accepts.

Core keeps one strict rule for whether a value is offered. The validator's structural comparison
(`sameOption`, deep and independent of key order) is also what draft restore uses. A stored value is
restored when an offered option holds the same data, whatever order its keys were written in.

Text standing for a number (`"2"`) is recognised by a widget, which reports the option's `2`. From
storage it is not restored: a draft holds what the form wrote, and the form writes the option's value.

## Consequences

- A select given a copy of an object option, or a numeric option's text, shows that option chosen
  and reports the option's value. A value that matches no option is still shown as its own
  unrecognised entry (ADR 0029).
- The validator and draft restore answer alike. A draft that would fail `oneOf` is not restored.
- Two rules remain: `sameChoice` for recognising, and `sameOption` for accepting. The difference is
  deliberate and covers exactly one case, text standing for a number.
- The select and option-group controllers, and the renderers that kept their own comparison, ask
  `sameChoice` too.
- An option's key still turns an array into text with `String()`, so two arrays of different objects
  share a key. Fixing that changes option keys and therefore part ids, so it is a separate decision.
- Matching by `sameChoice` scans the painted options when identity misses. That is linear in the
  list, on a path that runs when a value is set from outside the list.

## Alternatives rejected

- **`sameChoice` everywhere.** The validator would accept `"2"` for `2`, and a submitted value would
  stop being the type the option declared. That is a looser contract for data that leaves the form.
- **Strict deep equality everywhere.** A widget handed `"2"` from a query string or a JSON service
  would show nothing chosen while the model held a value. That is the defect this record closes.
- **JSON text for draft restore.** Its answer depends on key order, which is not part of a value.

## Verification

- `packages/widgets/test/a-restored-value-is-the-option-it-copies.spec.mjs`: a copied object and a
  numeric option's text select that option and report the option's value; a copy adds no list entry,
  and an unmatched value keeps its own. It is red without the `sameChoice` lookup in
  `select-controller.ts`. Its radio case is red without the same lookup in
  `option-field-controller.ts`.
- `packages/lit/test/a-restored-value-is-the-option-it-copies.test.mjs`: a searchable Lit select's
  trigger names the option a copy is; red with an identity comparison.
- `packages/core/test/a-draft-read-back-in-another-order.test.mjs`: a stored option with reordered
  keys is restored, and an unoffered object is dropped. It is red with the JSON comparison.

## Security and privacy

Draft restore stays a gate on untrusted input. It still accepts only values an offered option
holds; what changed is that the comparison no longer depends on key order. Strictness on type is
unchanged: text standing for a number is refused from storage. No new data is stored or exposed.
