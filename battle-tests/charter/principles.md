# Principles

## 1. Test claims, not methods

A battle names a public promise and tries to make it false. It does not restate what a method does.

```js
// Not a battle: it asserts that upsert does what upsert does.
form.f.rows.upsert("a", value);
assert(form.f.rows.has("a"));

// A battle: rendering must not govern existence, so it declares, mounts selectively, unmounts,
// reorders the presentation and remounts — and the declared value and validity must not move.
```

## 2. Black box first

The suite consumes package entry points, public types and public renderer APIs. It does not import
implementation source, read private fields or depend on symbols a consumer cannot reach.

`harness/internal-probes/` is the single exception and is marked as such. A probe there may support
a finding; it may never be the only evidence for a public claim.

## 3. Reproducibility is mandatory

Every generated failure reports its seed, the schema, the whole operation log, the states that
disagreed, the environment, and the smallest sequence shrinking could reach. A random failure that
cannot be replayed is a harness defect, and is fixed as one.

## 4. Independence from mount state

Claims about data, validity and submission are run under several mounting strategies: nothing
mounted, everything mounted, one cell per row, a rotating subset, controls mounted before their data
exists, controls retained while their row is removed. The canonical result must not differ unless
the public contract says it may.

## 5. Differential evidence

Where two public paths claim the same semantics — typed schema and dynamic contract, one renderer
and another, a workspace package and a packed one — they are fed the same operations and their
normalised observations are compared. Not their internals.

## 6. Fail loudly on an empty test

Every battle declares what it must have exercised, and the wrapper enforces it: operations executed,
structural changes made, mount and unmount phases entered, observations compared, async runs started.
No battle may pass because a selector, generator or adapter returned an empty set.

## 7. A break is followed through

Finding a contradiction is the point, not an inconvenience. A confirmed break is preserved, replayed,
minimised, promoted to a red regression test, and then fixed — with an ADR and a changeset when the
contract itself is what was wrong. A regression test is never weakened to match accidental behaviour.
