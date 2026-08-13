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
