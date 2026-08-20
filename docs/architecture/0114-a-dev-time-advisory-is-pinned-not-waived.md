# ADR 0114: A dev-time advisory is pinned, not waived

Status: Accepted

## Context

Twenty-three Dependabot advisories stood open across eight packages: `fast-uri`, `ip-address`,
`js-yaml`, `postcss`, `undici`, `hono`, `@hono/node-server` and `webpack-dev-server`. Seven high,
fifteen moderate, one low.

**All eight are transitive and dev-time.** None is a direct dependency of any workspace package, and
none is reachable from a consumer who installs a published `@modyra/*` package: they arrive through
the linter, the bundler, the site toolchain and the test transport, and none of them is shipped.

That makes the release question genuine rather than rhetorical. An advisory that cannot reach a
consumer is not a vulnerability *in the product*, so a repair that changes what the toolchain resolves
buys no safety for anyone installing the library — while a dependency bump is the change most likely
to break a build for reasons unrelated to the advisory that motivated it.

Every one of the eight was resolved at exactly **one patch below** the fix. The majors above have all
moved on — `fast-uri` is at 4, `js-yaml` at 5, `undici` at 8, `webpack-dev-server` at 6 — so an
unbounded override does not take the patch, it takes the next major.

## Decision

**Pin each advisory inside the major that is installed, in `pnpm-workspace.yaml`.**

Both halves are load-bearing.

*Pin rather than waive*, because "it does not reach a consumer today" is a property of the current
dependency graph and not of the package. A build tool that gains a runtime role, a dev dependency that
becomes a peer, or an advisory reclassified upward all turn a waiver into an unnoticed exposure. The
override is cheap and states the intent where the next reader looks.

*Inside the major*, because the goal is the patch. `"fast-uri@<3.1.5": ">=3.1.5"` reads like a patch
and resolved to **4.1.2**: an unbounded upper edge makes every override a standing invitation to the
next breaking release, applied silently at the next install. Each entry carries `<N+1`.

Overrides live in `pnpm-workspace.yaml`, where this project already keeps them, and **not** in
`package.json` — pnpm 11 no longer reads `pnpm.overrides` from a manifest and ignores the block with a
warning, so the same file that works under the CI's pnpm 10 would have been a silent no-op locally.

## Consequences

The toolchain resolves ten pinned ranges for eight packages; `js-yaml` and `undici` each carry two,
because two majors of each are installed and a single range cannot span them.

A pin is a claim that has to be revisited: when a package's own major moves and this project follows,
the `<N+1` bound becomes the thing preventing the upgrade rather than the thing protecting it. The
entry is then removed, not widened — a range that no longer names a live advisory is noise a reader
has to disprove.

The lockfile changes, and the lockfile is shared. Regenerating it while another session is installing
or building is the operational cost, and it is the reason this landed in an announced window rather
than opportunistically.

## Alternatives rejected

**Waive them and record the reachability analysis.** Defensible, and it is the honest reading of "no
consumer is exposed". Rejected because the analysis expires without saying so: nothing re-runs it, and
the next reader inherits twenty-three open alerts with a note claiming they are fine.

**Unbounded overrides (`">=3.1.5"`).** Simplest to write and what the first draft here did. Rejected
by measurement: it took `fast-uri` across a major boundary in the same install, which is a dependency
change wearing a patch's clothes.

**Upgrade the direct dependencies that pull them in.** Reaches the same versions through the front
door and keeps the graph honest. Rejected as a different piece of work with a different blast radius —
it changes what the toolchain *is*, and the advisories do not need it.

## Verification

    npx pnpm@10 install --frozen-lockfile --lockfile-only    accepted, lockfile unchanged
    pnpm install (v11.2.2)                                   lockfileVersion 9.0, unchanged

The pnpm 10 run is the one that matters: the CI pins pnpm 10 and installs with `--frozen-lockfile`,
so a lockfile written by a newer pnpm that the CI would refuse is a red that does not reproduce
locally. Checked in an isolated tree first — pnpm 11.2.2 still writes `lockfileVersion: 9.0`.

Resolved after the change, each inside its original major:

    fast-uri 3.1.5   ip-address 10.5.0   js-yaml 3.15.1 and 4.3.1   postcss 8.5.26
    undici 6.28.0 and 7.29.0   hono 4.13.3   @hono/node-server 1.19.17   webpack-dev-server 5.2.6

## Security and privacy

**No change to what a consumer of a published package receives.** None of the eight is shipped, so no
`@modyra/*` tarball's dependency graph moves.

What changes is the build machine: seven high-severity advisories no longer resolve in a tree that a
contributor, a CI runner and a release job all execute code in. That is the exposure this addresses,
and naming it that way is the point — a supply-chain advisory in a build tool is a real risk to the
people who build, and calling it "dev-only" as though it were nobody's is the mistake this record
exists to prevent.

No data handling, storage or transmission changes.
