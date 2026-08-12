# ADR 0033: One engine in the tree

Status: Accepted

## Context

Every package in this workspace except `@modyra/angular` declared its sibling dependencies at an
**exact** version — `"@modyra/core": "2.1.1"` — written in the manifest and rewritten by
`changeset version` at each release. Nobody decided that; it has been there since 2.0.0.

The packages version independently, and a release can land partially: on 2026-08-11 `@modyra/core`,
`@modyra/widgets` and `@modyra/angular` went public while nine adapters stayed a version behind. Two
current packages from the registry were then enough to install the engine twice:

```
npm install @modyra/plain@0.7.0 @modyra/widgets@2.0.2
→ node_modules/@modyra/core                               2.1.0
→ node_modules/@modyra/widgets/node_modules/@modyra/core  2.1.1
```

Two copies of `@modyra/core` are not two copies of the same behaviour. The engine keeps
module-level symbols and module-level registries: `MDY_VALIDATOR_FACTS`, `MDY_MARKS_REQUIRED`, the
handle-to-form registry. Measured on that install:

```
same MDY_VALIDATOR_FACTS symbol?  false
same MDY_MARKS_REQUIRED symbol?   false
core A reads the marker on its own rule:  true
core B reads the same marker           :  false
```

A `required()` built by one engine is **not required** to the other. That is the loss
[ADR 0030](0030-a-declared-fact-survives-composition.md) exists to prevent — `aria-required` gone, a
declared constraint never reaching the control — reintroduced by packaging rather than by code.

## Decision

**A package in this workspace depends on its siblings by range, never by exact version.** The range
is `^` on the version current at release, which is what `@modyra/angular` already published and what
a package manager can deduplicate.

The rule is enforced where it can be observed rather than where it is written: the tarball audit
installs everything this repository publishes into a clean consumer and **counts the copies** of
`@modyra/core` and `@modyra/widgets`. More than one fails the gate, naming the paths.

## Consequences

An adapter and the engine no longer have to be published in the same minute for a consumer to end up
coherent: a core patch reaches an installed adapter, which is the ordinary reason patches exist.

The combination a consumer runs is no longer the exact combination this repository tested. That is
the real cost, and it is the same cost every library with a runtime dependency carries; the contract
tests and the conformance suite are what make a range safe to offer, and `contract:diff` is what
makes a breaking change visible before it ships.

Two adapters that require **incompatible** majors still duplicate the engine. The gate fails in that
case rather than letting it through, which turns an invisible runtime split into a build error in
this repository.

## Alternatives rejected

**Keep the exact pins.** They guarantee the tested combination and, with independent versions, they
guarantee duplication whenever a release lands partially — which is not a hypothetical: it happened,
and it is what this record is written from. A guarantee that breaks the moment publication is not
atomic is not a guarantee.

**Make `@modyra/core` and `@modyra/widgets` peer dependencies.** This is the strongest answer: a peer
cannot be duplicated by an adapter, and a conflict becomes an install-time error the consumer
resolves. It was rejected for cost, not for correctness — every consumer would list the engine
explicitly, and the adapters are meant to be installable one at a time. If the gate ever fails
because two adapters really do need different majors, this is the alternative to reopen, and the
reason it was not chosen first is written here so that decision can be made in one read.

**Lockstep versions (`fixed` in the changesets config).** Every package moves whenever any one does,
so ranges become moot. It publishes thirteen packages for a typo in one, and it makes each package's
version stop meaning anything about that package.

## Verification

`npm run test:tarballs` installs every tarball this repository publishes into a consumer that has
never seen the workspace, and asserts a single copy of `@modyra/core` and of `@modyra/widgets`.

The gate was mutation-tested when it was written: pinning `@modyra/plain` back to an exact
`"@modyra/core": "2.1.0"` makes it fail with

```
@modyra/core is installed 2 times — two copies are two engines:
    node_modules/@modyra/core
    node_modules/@modyra/plain/node_modules/@modyra/core
```

so the check observes the installed tree rather than reading the manifests it is meant to police.

## Security and privacy

None directly. Indirectly, a duplicated engine is a correctness hazard with a security-adjacent face:
`MDY_MARKS_REQUIRED` and the validator facts carry the rules a control enforces, and a fact that does
not cross an engine boundary is a constraint silently not applied. Client-side validation is defence
in depth either way ([ADR 0009](0009-client-validation-is-defence-in-depth.md)); the server is still
the authority.
