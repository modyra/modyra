# Agent guidance

Operating rules for AI agents working in this repository.

The committed sources of truth, in order:

1. [CONTRIBUTING.md](CONTRIBUTING.md) — ground rules, commit and changeset conventions, the
   documentation policy (three registers, framework neutrality, claims that are forbidden, and
   the rule that a number in prose names the command that reproduces it).
2. [docs/architecture/README.md](docs/architecture/README.md) — the decision records. A change
   that contradicts a record is wrong until the record is superseded by a new one.
3. [SECURITY.md](SECURITY.md) — trust boundaries and supported versions.
4. [ROADMAP.md](ROADMAP.md) and [CHANGELOG.md](CHANGELOG.md) — what is ahead and what shipped.

Verification gates before considering work done:

```sh
npm run test:docs                  # links, orphans, dependency direction, decision records
npm run docs:sync && npm run docs:build
```

## Standing rules

- Do not write: **Task or process references.** Plan numbers, commit SHAs, "task 28 fixed this",
  "recorded in the ledger", anything about how the work was carried out or by whom. Express a real
  constraint in code — a type, an assertion, a test — or state the invariant in the present tense as
  a property of the code. The full comment policy is in
  [CONTRIBUTING.md](CONTRIBUTING.md) § *Comments and documentation*.
- **A migration preserves validation and runtime behaviour** unless the change is explicitly
  authorized; a contract change ships with a changeset stating its migration (see
  [the compatibility policy](docs/contract-compatibility.md)).
- **A decision record is superseded or amended, never edited into agreement with the present** —
  the mechanics are in [docs/architecture/README.md](docs/architecture/README.md).
- **`.modyra/` is a coordination directory**: it must never be the sole durable record of a
  decision. Durable decisions live in [docs/architecture/](docs/architecture/README.md).
- **When a tool's verdict and your own reading of a change disagree, stop and report the
  disagreement.** The conflict is worth more than either verdict alone.

Tool-specific instruction files are local to a contributor's machine, stay untracked, and nothing
in this repository may depend on them.
