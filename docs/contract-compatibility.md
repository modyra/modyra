# Contract compatibility

The widget contract is public API. Themes select on its classes, adapters implement its parts, and
generated code emits its schema — so a change to it reaches consumers who never called a function.
This is how such a change is classified, declared and checked.

## The three levels

| Level | What it is | Examples |
| --- | --- | --- |
| **Patch** | The tester is corrected without changing what output is valid. | A conformance check that was wrong now measures the right thing. A stricter audit that no conformant renderer fails. |
| **Minor** | Something is added that no existing consumer has to react to. | A new kind. A new optional part. A new state or class on an existing part. A newly declared key. A capability granted. |
| **Major** | Something an existing consumer depends on changes or disappears. | A part renamed or removed. A required part added. A relation retargeted or dropped. A semantic element or role changed. A class or state removed. A capability withdrawn. Cardinality changed. |

Two asymmetries are deliberate, and they are the ones easiest to get backwards:

- **Optional → required is major; required → optional is minor.** A new obligation fails every
  renderer that already conformed. Withdrawing one cannot break anyone who was already meeting it.
- **Adding a class is minor; removing one is major.** Themes select on classes. A class that stops
  being emitted is a stylesheet rule that silently stops matching — no error, just an unstyled
  control.

## How a change is measured

The contract is snapshotted into `packages/widgets/contract-baseline/contract-snapshot.json` — the
parts of each kind, where they hang, what they are, the classes and states they carry, the relations
between them, the declared keys and the capabilities. Nothing a renderer is free to choose is in
there: wrappers, node order between independent nodes, and eager-versus-lazy overlays are
implementation, and freezing them would report a breaking change every time someone reorganised an
internal detail.

```sh
npm run contract:diff       # what moved, and the verdict
npm run contract:snapshot   # accept the current contract as the new baseline
```

The output names the change in the contract's own vocabulary:

```text
colors.popup:
  element changed: popup → group  [major]

classification: major
```

### Comparing against a release, not against the working tree

`npm run test:contract-snapshot` only catches a contract edit that *forgot* to update the snapshot.
Once the snapshot is updated the two agree again and the change becomes invisible — which is correct
for that check and useless for a release note. To see what actually changed since a release, read
the snapshot from git:

```sh
node scripts/contract-diff.mjs --since v0.4.0
node scripts/contract-diff.mjs --since origin/main --require-changeset
```

## The check

`--require-changeset` fails when the pending changesets declare a smaller release than the contract
change requires. A major that ships as a minor is the failure this exists to prevent, because it is
invisible at review time and expensive afterwards.

The check accepts a bump on **any** `@modyra/*` package. The workspace is `fixed`, so every package
moves to one version together: a minor on the engine releases the contract as a minor whether or not
the contract's own package is named, and demanding a second changeset would add one that changes no
version.

## What you are owed

Classification says what a change costs. This says what you are promised, which is the part a version
number is actually claiming.

**Nothing in `@modyra/core` or `@modyra/widgets` is removed or changed in a breaking way outside a
major release.** That is the whole of the promise those two packages make, and everything below is
how it is kept honestly rather than by never changing anything. Both are at 2.0.0: the promise has
already been exercised once, and the release notes say what the major carried.

### A deprecation is an announcement, not a removal

Something on its way out is marked and keeps working:

```ts
/** @deprecated since 1.2 — use `stateCarriers` instead. */
```

Both halves are required and both are checked by `scripts/audit-deprecations.mjs`:

- **`since <version>`**, because a deprecation with no date cannot be aged out — it becomes permanent
  furniture that nobody is sure is still needed.
- **a replacement**, because a deprecation without one is not a migration path, it is a warning that
  something you depend on is going away and no statement of what to do about it. If there is genuinely
  nothing to move to, that is a removal being announced early and should say so in those words.

### How long it lives

**Until the next major, and never less than one minor release.** A consumer who upgrades minor
versions promptly always gets at least one release in which the old and the new both work, and one
that names the replacement in its changeset.

The floor matters more than the ceiling. Deprecating and removing within the same cycle is a breaking
change wearing a deprecation's clothes, and a policy that only says "until the next major" permits it
whenever a major happens to be near.

### What a removal owes you

A major that removes something carries, in its changeset: what went, what replaces it, and the
mechanical edit. "Removed `foo`" is a note; "replace `foo(a, b)` with `bar({ a, b })`" is a migration.

### Where this is weaker than it looks

- **The window is enforced by review, not by a check.** The audit sees that a marker is well formed,
  not that a removal waited. Ageing markers out would need release history the repository does not
  currently read.
- **It covers `@modyra/core` and `@modyra/widgets` only.** The adapters, the SDKs and Studio version
  independently and are still below 1.0; this page is not a promise about them.

## What is not covered

- **Renderer conformance is a separate question.** Each renderer's
  `conformance-manifest.json` records which kinds it draws and which features it really has,
  generated from its own conformance fixture. A contract can be unchanged while a renderer's
  coverage moves, and the manifests are what say so.
- **The manifests are repository evidence, not published files.** They are not in any package's
  `files`, so a consumer reading one has to read it here. Shipping them is a packaging decision that
  has not been taken.
- **Behaviour beyond the snapshot.** The snapshot holds structure, relations, classes, states,
  declared keys and capabilities. That a declared key *does* something is proved by the keyboard
  suites, not by this diff.
- **The Dynamic Form Contract is a different surface.** `MdyDynamicField` and its kinds are public
  API and are versioned by ordinary package semver; the snapshot does not describe them, so adding
  a field to one classifies as `patch` here while still being a `minor` release. Judge that surface
  by the usual rules for a TypeScript interface — a new optional property is additive, a new
  required one or a removal is not.
