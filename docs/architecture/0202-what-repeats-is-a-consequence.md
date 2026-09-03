# ADR 0202: What repeats is derived from the anatomy, not listed by name

Status: Accepted

## Context

`MdyStructureNode.repeated` answers "how many of these may there be". It was a hand-kept set of part
names in `catalog/define.ts`, whose own comment claimed the guarantee: *"A part that repeats says so
here; a part that does not, cannot."*

The list had drifted, and the drift was invisible because nothing could contradict it. Enumerating
every node against its parent found five parts declared singular while sitting inside a parent that
repeats:

| part | parent | what the contract claimed |
|---|---|---|
| `radio.optionControl` | `option` | one radio button across every choice |
| `segmented.optionControl` | `option` | the same |
| `segmented.optionText` | `option` | one label across every choice |
| `multiselect.chipMove` | `chip` | one reorder grip for all chips |
| `multiselect.chipRemove` | `chip` | one remove button for all chips |

Their siblings under the same parents — `optionCheck`, `optionLabel`, `optionCount`, `optionStep` —
were on the list, so the anatomy contradicted itself between one child and the next.

These describe pages nobody can build. A control cannot be drawn once and belong to two option rows;
a remove button cannot serve three chips. The declaration was not merely stale, it was unsatisfiable,
and it made a correct renderer non-conforming: drawing two choices and two radio buttons was reported
as `PART_CARDINALITY`, which is the check failing the right answer.

## Decision

**Repetition is inherited.** A part whose parent repeats, repeats — computed transitively in
`define()` after the anatomy is laid out, which is the pass that already knows every parent.

`REPEATED_PARTS` remains, and now names only where repetition *starts*: `option`, `chip`, `row`,
`gridcell`, and the rest. Where it continues is a consequence of containment, so a kind that grows a
part inside a repeating one inherits the answer instead of waiting for a name to be added.

The conformance kit gains the count rule this made possible. "Repeated" previously meant "any
number", so a group drawing two choices and one control conformed — the choice a person cannot make
was invisible to every check. A **required** part that repeats because its parent does must appear
once per parent, and the DOM already holds how many parents there are.

## Consequences

Five parts widen from `0..1` to `0..n`; `contract:diff` classifies this **major**. Nothing narrows,
and no capability is removed: every rendering that conformed before conforms now.

A consumer that read `repeated` to decide whether to cache a single element lookup for
`optionControl`, `optionText`, `chipMove` or `chipRemove` was already wrong on any real page and now
reads a declaration that matches what renderers draw. The changeset names the five.

The cost is that `repeated` can no longer be read off the table alone — it is a property of the
assembled anatomy. That is the same trade the parent, order and presence fields already make.

## Alternatives rejected

**Add the five names to the set.** One line, and it restores the exact condition that produced the
drift: a hand-kept list with no check that it agrees with containment. The sixth omission would
arrive with the next part added under a repeating parent, and be found the same way — by a renderer
being marked non-conforming for rendering correctly.

**Let the conformance kit's `counts` option carry it.** The hook exists and takes an expected count
per part, but it requires every config to declare numbers it has to keep in step with its own
fixture: knowledge duplicated per adapter, to state something the contract already implies.

**Leave the cardinality rule alone.** Deriving `repeated` alone would move five nodes into a class
with no count rule at all, quietly reducing what the kit checks. Verified as a real gap, not a
theoretical one — see below.

## Verification

- `npm run test:contracts`: 27 of 29 gates pass. The two failures are `test:contract-snapshot` and
  `test:type-surface` reporting the moves for acceptance, taken in the same commit.
- `contract:diff`: `major`, naming exactly the five parts predicted by enumeration before the change.
- The conformance kit over all four adapters that have a config — plain, lit, angular (17 kinds each)
  and vue (11) — is conformant where checked. The three mature renderers already drew one control per
  option, so the new rule reddens nothing that was right.
- **Falsification.** The derivation alone was checked for whether it *weakens* the rule, by planting a
  real defect: a vue option group rendering two choices and one radio button. It passed — repetition
  without a count rule accepts any number, so the group a person cannot fully operate conformed. With
  the per-parent rule the same plant fails by name in both group kinds: *"optionControl is drawn once
  per option, and the DOM has 2 of those but 1 of it"*. The plant was then removed and the suite
  re-run green.

## Security and privacy

No impact. The contract describes anatomy; no data crosses a boundary, and no rule here affects
authentication, storage, or what a page transmits.
