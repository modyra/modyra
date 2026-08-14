# Contribution policy

## Adding a battle

1. Name the public promise. If it is not in [`claims-under-test.md`](claims-under-test.md), register
   it first — with the public evidence that it is a promise at all.
2. Write the attack as operations, not as method calls: everything a generated campaign or a replay
   must be able to reproduce goes through `context.execute`.
3. Declare what the battle must have exercised via `requires`. A battle that can pass while doing
   nothing is not evidence.
4. State exclusions per assertion. A comparison that ignores whole fields of the canonical
   observation is a comparison that has stopped testing.

## When a battle finds a break

1. **Keep the report.** `reports/failures/<id>.json` carries the seed, schema, operations and both
   states.
2. **Replay it.** `npm run battle:replay -- <report>`. A failure that does not reproduce is a harness
   defect and is fixed before the finding is filed.
3. **Shrink it** to the smallest sequence that still breaks the claim.
4. **Promote it** to `regressions/<slug>.test.mjs`, citing the claim id, the seed and the original
   report. It must be red before the fix and green after.
5. **Classify it** with the [severity model](severity-model.md).
6. **Fix the implementation.** Smallest coherent change; the public contract is preserved by default.
   Where the contract itself is wrong, the fix carries a decision record and a changeset, and
   `npm run contract:diff` classifies the change.
7. **Leave the generative property active.** The regression pins one sequence; the campaign keeps
   looking for the next.

## When an attack finds a break

The seven steps above assume a report: a battle failed, `reports/failures/<id>.json` exists, and
there is a seed to replay and a sequence to shrink. Most breaks are not found that way. They are
found by reading a public promise, building the case that contradicts it, and watching it
contradict — and there is no report, because no battle existed yet.

For those, steps 1 to 3 have already happened by construction: the sequence is the one you wrote, it
is minimal because you wrote it minimal, and it reproduces because you have run nothing else. What
replaces them is the same evidence stated differently:

1. **Write the battle before reporting the break**, and let it fail. A probe convinces you; a battle
   convinces the code, and the two are independent — see [principles](principles.md) 8. A finding
   reported from a terminal beside a battle that never asserted it is unbacked, however real the
   defect turns out to be.
2. **Check that the red is the one you wrote.** Not merely that it is red — [principle 10](principles.md).
3. **Keep the battle where its claim lives**, in `adversarial/<area>/` beside the others that cite
   it, rather than in `regressions/`. That directory is for a sequence a campaign found and a human
   reduced; a hand-built case is already at its smallest and gains nothing from being moved away
   from the claim it is about.

Steps 5 to 7 are unchanged. A break found by attack is classified, fixed and recorded exactly as one
found by a campaign — what differs is only where the evidence came from and where the battle lives.

## Prohibited

- Importing implementation source to make setup easier.
- Repeating an existing unit test under a new folder.
- Huge unreviewable DOM snapshots.
- Arbitrary sleeps where an observable condition exists.
- Swallowing a warning or diagnostic instead of asserting on it.
- Generating operations without recording the seed first.
- Broad renderer-specific exclusions.
- Mocking the exact thing whose contract is under test.
- A reference model structurally identical to Modyra's own implementation.
- Treating an axe pass as complete accessibility evidence.
- Calling a benchmark a battle test unless it also checks correctness.
- Weakening a regression test to match behaviour that was never decided.
