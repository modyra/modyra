# ADR 0228: The Java reader runs on every push, against a ledger of where it disagrees with the corpus

Status: Accepted

## Context

The shared corpus under `spec/fixtures/dynamic-form/` is read by four runtimes. CI checks the three
JavaScript ones and the Rust reader on every push; nothing ran the Java reader. Its suite walks the
whole corpus and compares each document with the verdict recorded beside it, but it stopped at the
first disagreement, and measured on 2026-10-12 it disagrees on 18 of 33 documents:

- 15 the corpus refuses and Java accepts — pattern safety, version gates, expression shape and
  depth, condition scope;
- 3 the corpus accepts and Java refuses — the `daterange`/`file`/`colors` kinds, layout nested eight
  levels (Java caps layout at 6, TypeScript and Rust at 32), and the flat v5 envelope.

A suite in that state cannot gate anything: added to CI it is red until every disagreement is fixed,
and left out of CI it is never run, so a change that makes the Java reader worse lands unseen. The
Java fixes themselves cannot be verified while nothing runs the suite.

## Decision

- CI runs `./mvnw -B test` in `sdk/java/modyra-contract` on every push, as a step of the main job
  after the Rust reader, on the runner image's JDK 17 with Maven pinned by the wrapper.
- The corpus test collects every disagreement and compares the set with
  `sdk/java/modyra-contract/src/test/resources/known-corpus-disagreements.json`. The comparison is
  exact in both directions: a disagreement not listed fails, and a listed document that now agrees
  fails until it is removed from the list.
- The ledger only shrinks by repair. A new entry is a recorded regression and is not added to make a
  build green.

## Consequences

- A Java regression against the corpus fails CI from now on, and each Java fix is visible as a
  ledger line removed.
- 18 known disagreements are accepted as the starting state. The Java SDK still contradicts the
  contract on those documents, and the ledger records that rather than hiding it; it is not a claim
  that the Java reader conforms.
- CI gains a dependency on Maven Central at run time (the wrapper and the plugins are downloaded on
  each run, uncached). An outage there fails the step.
- The main job gets roughly half a minute longer.
- The ledger names documents, not reasons. A listed document that starts disagreeing for a second,
  different reason stays green. Group-by-cause repair batches narrow that window; they do not close it.

## Alternatives rejected

- **Fix the Java reader first, add CI after.** Every fix would be verified only on the machine that
  made it, and nothing would stop the next change undoing it. Running the suite is the precondition
  for trusting the fixes, not their reward.
- **Add the job with `continue-on-error`.** A step that cannot fail is a log nobody reads. It also
  hides new regressions behind the 18 known ones.
- **Skip the listed documents.** A skipped document is unread. The ledger reads it and fails when it
  starts agreeing, so a repair cannot be forgotten in the list.
- **A separate CI job with `actions/setup-java`.** The image already ships the JDK the module compiles
  for, as it ships cargo for the Rust step. A second job adds a status check and a toolchain action to
  maintain, and buys parallelism for a step that takes seconds.

## Verification

- `./mvnw -B test` in `sdk/java/modyra-contract`, run in CI.
- Falsified on 2026-10-12. Removing `v4/a-expression-too-deep.json` from the ledger fails with
  "disagrees with the corpus and is not in known-corpus-disagreements.json". Adding
  `v2/valid.json`, which agrees, fails with "agrees with the corpus now, so remove from …".
- Run from a clean export with an empty Maven home and an empty local repository: 27 tests, green.

## Security and privacy

CI now downloads the Maven distribution and the module's plugins and dependencies from Maven Central
on each run. The wrapper pins the Maven version and the POM pins every plugin and dependency version,
but no checksum is verified. A compromised artifact at those coordinates would run inside the CI job
with what that job holds: no publishing secrets, but the workflow token `actions/checkout` persists in
the clone, at the repository's default permissions, since `ci.yml` declares none. That is the same
exposure `pnpm install` already creates for every npm dependency; this adds a second registry to it
rather than a new kind of trust. Narrowing the token is a separate decision. No user data is touched.
