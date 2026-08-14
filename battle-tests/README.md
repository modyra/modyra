# Battle Tests

An adversarial suite whose job is to **disprove** Modyra's public promises.

The rest of the repository asks whether an implementation satisfies its declared contract. This
suite asks whether the contract still holds when a consumer combines valid operations in hostile
orders, mounts fragments of a form, lets asynchronous work complete at the worst moment, crosses
package and renderer boundaries, or restores data nobody expected. It succeeds when it finds a
contradiction. A green run means only that these attacks did not falsify a claim.

## Running it

```sh
npm run battle              # build the consumed packages, then every battle
npm run battle:quick        # the adversarial suites only
npm run battle:generative   # the seeded campaigns alone
npm run battle:campaign     # a long campaign (MDY_BATTLE_RUNS, default 400)
npm run battle:browser      # the Plain lifecycle, in Chromium, on a bundled host page
npm run battle:audit        # the black-box rule: no reach past a package entry point
npm run battle:replay -- battle-tests/reports/failures/<id>.json
```

Environment:

| Variable | Meaning |
| --- | --- |
| `MDY_BATTLE_SEED` | Replay a campaign exactly. Printed by every generated run. |
| `MDY_BATTLE_RUNS` | How many generated runs per campaign. |
| `MDY_BATTLE_ENV` | Names the environment a failure was found in (`node`, `plain-chromium`, …). |

## How a battle is written

```js
battle(
  {
    claims: ["COL-003"],
    title: "validity is independent from mounted cells",
    requires: ["structural", "unmountedPhases", "observations"],
  },
  async (ctx) => {
    const context = ctx.open(KEYED_ROWS_SPEC);
    await context.execute({ type: "record.upsert", path: "rows", key: "a", value: { code: "x" } });
    // …
  },
);
```

- **Every battle cites a claim.** The registry is [`models/claims.mjs`](models/claims.mjs); citing an
  id that is not registered is an error, because a break nobody can name is a break nobody can act on.
- **Every battle proves it attacked, and that it concluded something.** `requires` names counters
  that must be positive — structural changes, mount and unmount phases, observations compared, async
  runs started. `actions` and `assertions` are always required on top of those, so a battle whose
  selector or generator returned an empty set fails instead of passing, and so does one that
  exercised a path without ever stating what the path had to do.
- **Every failure is an artefact.** The wrapper writes `reports/failures/<id>.json` with the seed,
  the schema as data, the operation log, both states and the replay command. `MDY_BATTLE_REPORTS`
  points one battle at a directory of its own, which is what a check that reads its own report back
  uses so it cannot destroy another battle's.
- **A blocker is enforced, never reported.** `open` marks a finding that is real and waiting on a
  decision; it is refused for a battle citing an S0 or S1 claim, because a release or merge blocker
  that reports without failing is not a blocker.

## Rules this suite holds itself to

1. **Black box.** Battle tests import published entry points only — `@modyra/core`,
   `@modyra/widgets`, `@modyra/widgets/testing`, `@modyra/lit`, `@modyra/react`, `@modyra/vue`,
   `@modyra/zod` — which resolve to each package's built output. `@modyra/plain` is reached the same
   way from the browser tier, which bundles it. `harness/black-box-audit.mjs` fails the suite if any
   file reaches into a package's source tree, and it runs as part of every battle run.
2. **One interpreter.** Hand-written battles, generated campaigns and the replay command all execute
   operations through `harness/context.mjs`. A second execution path would replay the harness rather
   than the failure.
3. **No arbitrary sleeps in model tests.** `harness/scheduler.mjs` drives time; browser battles wait
   on observable conditions.
4. **Narrow exclusions.** A differential comparison may ignore only the fields the claim permits to
   differ — `RENDERER_ONLY_FIELDS` is `mountedPaths` and nothing else.
5. **Synthetic fixtures.** Reports are written from the fixtures, so nothing in them can be a secret.

## Deviations from the specification

The implementation specification (kept with the project's coordination state, outside version
control) sketches this suite in TypeScript on Vitest with fast-check. Two deliberate differences:

- **`node:test` and `.mjs`, no new dependencies.** The repository already runs `node --test` for
  core, adapters, widgets and studio; adding Vitest would make a fourth runner, and fast-check a
  dependency this suite does not need. Property generation and shrinking live in `harness/`
  (`seed.mjs`, and `shrinking.mjs` when the generative campaigns land). The specification permits
  this choice explicitly.
- **Consuming built output rather than TypeScript source.** Importing bare package specifiers makes
  the black-box rule structural rather than a convention: a symbol missing from a package's published
  entry point is unreachable here, exactly as it is for a consumer.

`reports/.gitkeep` from the specification's tree is a `README.md` instead, because the repository
ignores dotfiles.

## Layout

| Directory | What lives there |
| --- | --- |
| `charter/` | What the suite is for, what it may not do, and how a break is triaged. |
| `harness/` | The wrapper, the interpreter, the clock, the canonical snapshot, reporting and replay. |
| `models/` | Claims, operations, severities, observation encoding, schema specs as data. |
| `adversarial/` | Attacks on one surface: lifecycle, collections, validation, reactivity, security. |
| `differential/` | Two public paths that claim the same semantics, fed the same operations. |
| `generative/` | Seeded campaigns, the independent reference model, shrinking. |
| `hostile-consumers/` | A consumer that installed the tarball, compared against the workspace. |
| `scenarios/` | Realistic end-to-end battles: keyed invoice, virtual inventory, async registration. |
| `browser/` | The host page a real browser mounts, and the lifecycle battles that read its DOM. |
| `regressions/` | Confirmed breaks, minimised, red before the fix that closed them. |
| `reports/` | Failure artefacts from the last run. Not committed. |

## Tiers

`.github/workflows/battle-tests.yml` runs three of them:

- **pull request** — the black-box rule, then every deterministic battle and a fixed-seed campaign
  (`MDY_BATTLE_SEED=20260814`, 25 runs), so a red run is reproducible from its log alone;
- **main** — the same, plus the browser lifecycle in Chromium;
- **scheduled and manual** — a long campaign under a seed drawn and printed before anything runs,
  400 generated runs by default, uploading every failure report when it finds one.

Each tier's command is the same one a maintainer runs locally; nothing is expressed only in YAML.

## When a battle finds a break

See [`charter/contribution-policy.md`](charter/contribution-policy.md). In short: keep the report,
replay it, shrink it, promote it to `regressions/` red, then fix the implementation — a break is the
material for making the framework harder to break, not a note to file.
