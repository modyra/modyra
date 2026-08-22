# TypeScript 7 and the primary compiler

Modyra compiles its libraries with TypeScript 7 and keeps TypeScript 5.9 for the two toolchains that
cannot accept it. This page says which compiler runs where, how to check it, and how to go back.

The reasoning is [ADR 0019](../architecture/0019-typescript-7-compiles-the-libraries.md).

## Which compiler compiles what

| Compiled by | What |
| --- | --- |
| `typescript7` — the npm alias for TypeScript 7.0.2 | Every project with a `packages/*/tsconfig.json`: core, widgets, the eight adapters, and the ten Studio packages. This is what ships in the tarballs. |
| `typescript` — 5.9.3 | The Angular package, through `ng-packagr` and `jest-preset-angular`, and the compiler API that Studio embeds. |

Two contracts draw that line, and neither is ours to move:

- `@angular/compiler-cli@21.2.18` peers `typescript ">=5.9 <6.1"`; `ng-packagr@21.2.5` peers
  `">=5.9 <6.0"`. Both load the `typescript` **module**, so they follow the dependency, not the
  command line.
- TypeScript 7.0.2 exports only `./lib/version.cjs` from its package root. Studio's type-check host
  and code-generation worker import `createProgram` and friends from that root; the 7.x replacements
  live under `./unstable/*` and are a different API.

## Naming the compiler

No build script calls `tsc`. With both compilers installed, `node_modules/.bin/tsc` resolves to
TypeScript 7 whatever the alias is called — the winner is the package manager's link order, so the
name says nothing about what runs. Build scripts go through the wrapper instead:

```bash
node scripts/tsc7.mjs packages/core/tsconfig.json packages/widgets/tsconfig.json
```

It resolves the compiler as a module, asserts the major version, and compiles the projects in the
order given.

The per-package `"build": "tsc -p tsconfig.json"` scripts are a manual convenience and still resolve
whatever `.bin/tsc` happens to be. The root scripts are the build path.

## Checking that the two compilers agree

```bash
npm run test:typescript7
```

Compiles all twenty-one projects with **both** compilers into a temporary directory and compares the
emits file by file — nothing is written to `dist`, so the check cannot be confused with a build.

It tolerates exactly one kind of difference: the textual order of the members of a string-literal
union. `"label" | "root"` and `"root" | "label"` are the same type, and the two compilers order them
differently in the `catalog.d.ts` each emits from `packages/widgets/src/catalog.ts`. Every other
difference fails the check, as does any file one compiler emits and the other does not.

This check is what licenses shipping TypeScript 7 output, so it runs in CI.

## Going back

```bash
MODYRA_TSC=typescript npm run build:packages
```

Every script that compiles through the wrapper honours the variable, so one environment variable puts
the whole repository back on 5.9 — for a bisect, for a comparison, or as the fallback if the
equivalence check ever fails.

## What would have to change to move the line

For **Angular**: `@angular/compiler-cli` and `ng-packagr` declaring a peer range that includes 7, and
`build:angular`, `test:angular` and `test:bundle` green without `--force`.

For **Studio**: a decision about the embedded compiler API — keep it on a pinned legacy dependency,
move type-checking and formatting out of the browser worker, or adopt the 7.x programmatic API once
it is no longer published under `unstable`. Rewriting the import is not a migration; the APIs are not
equivalent.

## Benchmark

`benchmarks/typescript-compilers.html` holds a measured comparison of the two compilers across the
projects, with the machine it was measured on. Regenerate it with:

```bash
npm run benchmark:typescript
```
