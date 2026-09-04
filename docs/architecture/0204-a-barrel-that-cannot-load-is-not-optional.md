# ADR 0204: A dependency the barrel cannot load without is not optional

Status: Accepted

## Context

ADR 0130 puts an overlay panel outside the field it belongs to, so it does not inherit an ancestor's
`overflow` or stacking. Every renderer needs a door for that. Vue's is `Teleport`, which its own core
provides; React's is `createPortal`, which lives in `react-dom` — a package `@modyra/react` had never
named.

Three shapes were on the table, and the fact that decides between them is not a matter of taste.
`@modyra/react` publishes a single entry point: `.` resolves to a barrel that re-exports every
module. A static `import … from "react-dom"` anywhere in that graph is resolved when the barrel is
loaded, by every consumer, including one who imports it to use a single headless hook.
`sideEffects: false` lets a bundler drop the module, but module resolution in Node happens before any
of that.

Measured rather than reasoned about. A consumer built the way the tarball audit builds one — the
packed tarballs plus `react`, and no `react-dom` — importing the barrel to read one hook off it:

```
ERR_MODULE_NOT_FOUND   Cannot find package 'react-dom'
```

and with `react-dom` installed and nothing else changed, the same import loads and the hook is a
function. The probe was shown able to answer both ways before either answer was trusted.

## Decision

`react-dom` is a **required** peer dependency of `@modyra/react`. `@types/react-dom` is an optional
peer alongside it, for the same reason `@types/react` is: the published declarations import from a
package whose types ship separately, and a consumer type-checking what we ship needs them in front of
it.

The package does not claim to be usable without a DOM renderer. It has hooks that would work without
one, and no way to reach them: what a manifest declares is what the package can actually do.

## Consequences

A consumer on React Native, or on a custom renderer with no `react-dom`, can no longer install
`@modyra/react` without an unmet peer warning. That consumer could not have used it anyway — the
barrel would not load — so the manifest now says out loud what the graph already enforced.

The declaration is also a floor we have to keep: any future split of this package into a headless
entry point and a widgets entry point has to move this peer with it, or the promise inverts again.

## Alternatives rejected

**An optional peer**, with the portal failing at the point of use with a named error. Rejected by the
measurement: the failure is not at the point of use, it is at module resolution, and it takes the
whole barrel with it. Declaring optional what the package cannot start without is a false statement
in the manifest, and the error a consumer would meet is an anonymous resolution failure rather than
the named one that shape was chosen for.

**A second entry point** (`@modyra/react/widgets`) declaring the peer, keeping `.` headless. This is
the right shape if "headless" is a promise held by contract rather than by convention, and it is the
more honest package. It loses here on scope and timing: it is a new exports subpath, a new build
target and a change to the tarball audit, none of which belongs inside the unit that draws a select.
It is a decision about the package's shape, not about a portal.

**Its condition for coming back**: a real consumer who wants the hooks without a DOM renderer. Not
before — the smallest public surface wins this close to 1.0 (ADR 0014's principle), and a subpath
added for a consumer nobody has met is surface that has to stay stable for one.

## Verification

`npm run test:tarballs` builds a consumer from the packed tarballs and the declared peers, imports
every declared entry point and type-checks what we ship. With `react-dom` undeclared and imported,
that consumer fails to resolve the barrel; with it declared, the consumer installs it and the import
succeeds. The audit is what turns this record into a check rather than a note.

What it does not guard: the reverse claim. Nothing fails if a future refactor removes the last
`react-dom` import and leaves the peer declared — the package would then demand more than it needs,
which is a cost to a consumer and invisible here.

## Security and privacy

None. The change adds no code path, no data flow and no trust boundary; it names a package the
consumer already installs to render React at all.
