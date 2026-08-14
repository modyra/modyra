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

---

The seven above are about writing a battle. The five below are about reading what it tells you, and
each was learned by getting it wrong: a battle that agreed with itself, one that passed while
asserting nothing, one that failed for a reason nobody wrote, and two defects diagnosed in the wrong
place. They are here because each cost hours to find once and costs a paragraph to avoid again.

## 8. A finding's evidence comes out of the battle

A probe convinces you. A battle convinces the code. They are independent, and a finding is only as
good as the second.

A campaign of probes on the side of a battle is how most findings actually start, and there is
nothing wrong with that — but the moment the probe is right and the battle is silent, the report
that crosses to whoever fixes it is unbacked. That has happened here: a measured, real defect
reported from a battle whose assertion never ran. The defect was genuine and the evidence was not,
and those two facts had nothing to do with each other.

So before a finding is reported, the assertion that carries it has to have executed and failed.

## 9. A check that performs the derivation it asserts can only agree with itself

If a battle computes the thing it is about, it has assumed the answer it then confirms.

Two battles here derived an option's key with `String(option.value)` and asserted that keys are
distinct. The defect was that the engine derived keys the same way. No fix could ever satisfy those
battles, and no defect could ever fail them: they were asserting about a copy of the mechanism under
test.

Read what the thing published, the way its consumer reads it — a part name out of the view, a key out
of the state — rather than recomputing it here.

## 10. Suspect the instrument

Three signals, and the second and third are the ones that need looking for.

- **Everything breaks, including a case you know is good.** The fixture, the call shape or the
  environment is wrong, not the product. A known-good case in the same run is what makes this
  visible, and it is cheaper than a control and catches a wider class: a control proves the detector
  *can* fire; a known-good case proves it is answering about the input rather than about itself.
- **Nothing breaks and you expected it to.** A battle written against a defect should be red. When
  it is green, the filter matched nothing, the assertion compares two things that are always equal,
  or the fixture never reached the code. This announces nothing — it has to be gone looking for.
- **It breaks, and you expected it to break.** Require that the red is the one you wrote. Red for
  the wrong reason wears the face of success, and unlike a false green it produces a *report* —
  which crosses to whoever fixes it and can put a change into the product for a defect that was
  never there.

## 11. A boundary assertion is worth more than its stated purpose

The green half of a battle — the case that pins what a fix must not disturb — catches more than it
was written for, because a fix passes through it while a defect only sits beside it.

Every overshoot caught in this campaign was caught by one: a fix that dropped a field instead of
degrading it, a resolver that stopped merging, an import block emitted from a source that no longer
existed. None of those was what the assertion was written to check.

They are also the assertions most likely to be silently wrong, because nothing pulls them toward
red — there is no defect they were written against. Both facts are true at once, which is the
argument for writing them and for checking them against the parent commit like any other.

## 12. Measure where it breaks before deciding what to fix

Reading finds the plausible cause. Running finds the actual one.

A recursive walk over a project's layout overflowed the stack, and both sessions read the walk and
concluded it was the walk. The stack said `structuredClone`, one frame down, in a package neither had
written — so making the walk iterative would not have moved the number by one.

And when two things give way at the same number, that is one cause rather than two. A layout and a
schema both failing at 1515 levels is not a coincidence to note; it is a fingerprint that says the
same frame is under both, and it turns a second investigation into one line of reasoning.
