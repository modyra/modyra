# ADR 0019: TypeScript 7 compiles the libraries

Status: Accepted

## Context

TypeScript 7 is the native compiler. On this repository it builds `build:packages` in 3.2 s against
7.9 s for TypeScript 5.9 — the same twenty-one projects, the same sources.

Two consumers cannot follow it, and neither is ours to move:

- `@angular/compiler-cli@21.2.18` declares the peer range `typescript ">=5.9 <6.1"`, and
  `ng-packagr@21.2.5` declares `">=5.9 <6.0"`. Both load the `typescript` **module**, never the
  command line, so what they compile with is decided by the dependency, not by a script.
- `typescript@7.0.2` exports only `./lib/version.cjs` from its root. Studio's type-check host and
  code-generation worker import `createProgram`, `createSourceFile`, `createPrinter` and
  `transpileModule` from that root. The 7.x equivalents live under `./unstable/*` and are a different
  API, not a drop-in.

So the question was never "5.9 or 7". It was: does the boundary between them fall where a peer range
forces it, or does the whole repository wait for the slowest consumer.

A third fact decided *how* the boundary is expressed. With both compilers installed —
`typescript` and the `typescript7` npm alias — `node_modules/.bin/tsc` resolves to 7.0.2, and it does
so under either alias name, so the winner is the package manager's link order and not a choice
anybody made. A build script that says `tsc` says nothing about which compiler runs.

## Decision

TypeScript 7 compiles every project that owns a `packages/*/tsconfig.json` — core, widgets, the eight
adapters, plain and the ten Studio packages — including the artifacts that ship in the tarballs.
TypeScript 5.9 remains the `typescript` dependency and compiles what a peer range or a root-export
contract requires: the Angular package through ng-packagr and jest-preset-angular, and Studio's
embedded compiler API.

No build script invokes `tsc` by name. Every project compiles through `scripts/tsc7.mjs`, which
resolves the compiler as a module and asserts its major version. `MODYRA_TSC=typescript` compiles
everything with 5.9 instead.

Promotion was licensed by evidence, not by the absence of errors: both compilers emit all twenty-one
projects and the outputs are compared file by file. The only tolerated difference is the textual
order of the members of a string-literal union, which is the same type either way.

## Consequences

The published `.js` and `.d.ts` are emitted by a compiler Angular's own toolchain does not accept.
That is safe exactly as long as the equivalence check keeps passing, so the check is not optional
scaffolding — it is the thing holding the decision up.

Two compilers now sit in the lockfile: TypeScript 7 brings twenty platform binaries as optional
dependencies, of which one is installed per machine.

`packages/studio-ui/src/styles.d.ts` exists because TypeScript 7 reports `TS2882` for the
side-effect import of `./studio.css` that 5.9 accepts silently. The declaration is correct under both.

The per-package `"build": "tsc -p tsconfig.json"` scripts are a manual convenience and still resolve
whatever `.bin/tsc` points at. They are not the build path — the root scripts are — but they are not
authoritative about the compiler either.

When Angular's peer range opens, this decision does not need reversing; it needs the boundary moved.

## Alternatives rejected

**Replace `typescript` with 7.0.2 outright.** Breaks ng-packagr's peer contract and breaks Studio at
runtime, since `createProgram` is not exported from the 7.x root.

**A parallel compatibility lane that only type-checks.** It was the original plan. It produces
evidence of readiness and none of the speed, and the evidence decays because nothing depends on it.

**Leave the compiler to `node_modules/.bin/tsc`.** Measured: the alias wins that link under every name
tried. The repository would ship whatever the last install linked, and a compiler change would leave
no trace in any file.

**Stay on 5.9 until Angular moves.** Ties twenty-one projects to the schedule of the one that cannot
follow, for no correctness gain.

## Verification

`npm run test:typescript7` compiles all twenty-one projects with both compilers into a temporary
directory and compares the emits file by file; it fails on any difference that is not string-literal
union member ordering, and on any file emitted by one compiler alone. It is wired into CI.

`scripts/tsc7.mjs` fails if `typescript7` resolves to anything other than a 7.x version.

The surrounding gates carry the rest: `test:contract-snapshot` proves the public surface did not move,
`build:angular` proves 5.9's compiler-cli can read TS7-emitted declarations, and `test:bundle` and
`test:core-bundle` prove the emit did not grow.

## Security and privacy

No trust boundary moves. TypeScript 7 is a build-time dependency from the same publisher as the
compiler already in use, it produces no runtime code path of its own, and no artifact reaches a user
that was not already produced by a compiler in this repository. The added supply-chain surface is the
`typescript` package at a second version plus its platform binary packages, all resolved through the
lockfile and subject to the same `pnpm audit` step as everything else.
