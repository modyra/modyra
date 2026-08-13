# ADR 0039: A breaking change shipped as a patch

Status: Accepted

## Context

This release removes fourteen of `@modyra/core`'s twenty subpath entries and four of
`@modyra/widgets`' six, moves the UI vocabulary out of the engine, and drops a part from two widget
anatomies. Under semantic versioning that is a major.

It is shipping as a patch, `2.1.2 → 2.1.3`, because the library has no consumers. Every import that
would break is inside this repository and was updated in the same commits that broke it.

The reason this needs a record rather than a changeset line: a version number is the only thing most
readers will ever see. Someone reading `2.1.2 → 2.1.3` in a changelog two years from now will assume
nothing was removed, and the assumption is wrong. A convention broken silently is indistinguishable
from a convention nobody knew about.

## Decision

**The jump is deliberate, bounded, and does not set a precedent.**

- The removals are published as a patch **once**, in this release, and only because the consumer set
  is empty and verified empty — not estimated.
- From the first external consumer onward, semantic versioning is followed as written: a removal is
  a major, and a deprecation cycle precedes it.
- The migration table below is the complete list. A removal that is not on it is a defect in this
  record, not a permitted omission.

### What moved

| removed | where it lives now |
|---|---|
| `@modyra/core/ui`, `/keyboard`, `/icons`, `/options-utils` | `@modyra/widgets` — ADR 0036 |
| `@modyra/core/i18n`, `/localization` | `@modyra/widgets` — ADR 0036 |
| `@modyra/core/color-utils`, `/theme-compiler` | `@modyra/styles` — ADR 0035 |
| `@modyra/core/date-utils`, `/time-utils`, `/date-locale` | `@modyra/core/datetime`, which aggregated them already |
| `@modyra/core/dynamic-config`, `/validation`, `/form` | `@modyra/core` — every export was already on the main entry |
| `@modyra/widgets/ids`, `/runtime`, `/commands` | `@modyra/widgets` — every export was already on the main entry |
| `@modyra/widgets/contract` | `@modyra/widgets/vocabulary` for the tables; the types stay on the main entry |
| the `actions` part of `datepicker` and `daterange` | removed: those kinds commit live, so a confirmation affordance was an anatomy contradicting a contract — ADR 0023 and the commit-affordance gate |

## Consequences

The changelog is load-bearing in a way it should not have to be. Anyone auditing this project's
release discipline will find one release that broke its own rule, and will have to read this record
to learn that it was bounded rather than habitual.

Tooling that trusts semver — a dependency bot, a lockfile range — would have accepted this patch and
broken. Nothing did, because nothing depends on the packages, but the window existed and the next
one must not.

The verification below cannot prove the consumer set is empty outside this repository. It proves it
inside, which is the whole of the claim being made.

## Alternatives rejected

**Publish as 3.0.0.** Correct by the letter and misleading in substance: a major signals a migration
that consumers must perform, and there are none. It also spends the number that the first real
breaking release should carry.

**Deprecate, keep the old subpaths, remove in the next major.** Fourteen shims across two packages,
each one a second door to a symbol — which is the exact defect `audit-public-doors` was written to
prevent, reintroduced in the same release that removed 82 ambiguous doors.

**Do not remove anything; leave the UI contract split across two packages.** That is the status quo
ADR 0006 declares untenable, and leaving it costs a permanent inversion of the dependency direction.

## Verification

- `node scripts/audit-public-doors.mjs` — reads every `@modyra/core` and `@modyra/widgets` import in
  the repository, `examples/` and `site/` included, and fails if one does not resolve. This is the
  check that the consumer set inside the repository is empty of broken imports; it was added after a
  removal reached a demo unnoticed.
- `node scripts/contract-diff.mjs --require-changeset` — the widget catalogue's own diff, with a
  semver verdict and a changeset required.
- `npm run test:type-surface` — the type-level removals, classified and recorded.
- `npm run test:docs` — this record is listed and structurally complete.

## Security and privacy

None. No trust boundary, credential path or data format changes. The one adjacent consideration is
supply-chain: a patch that removes API could surprise an automated updater, and the answer is that
there is nothing to update — see the verification above for how that is established rather than
assumed.
