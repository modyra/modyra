/**
 * What one editorial command costs, against what it changes.
 *
 * A Studio command takes a project and returns the next one, and every one of them starts by copying
 * the project whole: `structuredClone(project)` appears thirty-six times in `commands.ts` alone. A
 * rename changes one string. A node update changes one node. Both pay for the whole document.
 *
 * The measurement that decides it is not growth — growth is what a machine's allocator does anyway.
 * It is **a rename against a bare clone, in the same process, at the same size**:
 *
 *     shape           clone   rename   update   rename − clone
 *     flat 10         0.016   0.015    0.019    -0.001
 *     flat 100        0.078   0.077    0.080    -0.001
 *     flat 1000       0.699   0.687    0.695    -0.012
 *     10 groups × 10  0.081   0.081    0.086    -0.001
 *     40 groups × 25  0.713   0.708    0.716    -0.006
 *
 * A rename costs a clone, to within the noise, at every size and in both shapes. So the cost of a
 * command is **proportional to the project and independent of the edit** — which is the property, and
 * a ratio between two calls in one process rather than a threshold a slower machine could cross.
 *
 * In absolute terms this is not an interruption today: 0.7 ms per command on a thousand fields is
 * invisible, and a twenty-step history holding twenty copies is about 1.9 MB. It is a defect of
 * **scale** with a memory multiplier, and it becomes visible exactly where a small form never looks.
 *
 * Green when a command that changes one string costs materially less than copying the whole project.
 * The repair is a shape change — copy the path from the root to the touched node — so this battle
 * states the property and leaves the design to a record.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const REPO = resolve(HERE, "..", "..", "..");

/**
 * A Studio package's published entry, read from its own manifest.
 *
 * These are not linked at the repository root, so a bare specifier resolves nowhere from here — which
 * is why the battles beside this one install a packed consumer. That is the right instrument for
 * asking what a consumer *gets*; this asks what a command *costs*, which is the same code either way
 * and does not need a tarball to be honest about.
 */
async function studio(name) {
  const at = join(REPO, "packages", name);
  const manifest = JSON.parse(readFileSync(join(at, "package.json"), "utf8"));
  const entry = manifest.exports?.["."];
  const file = typeof entry === "string" ? entry : entry?.default ?? entry?.import ?? manifest.main;
  return import(pathToFileURL(join(at, file)).href);
}

/** A project of `count` flat fields, built through the model's own door. */
function projectOf(createBlankProject, count) {
  const project = createBlankProject();
  const children = {};
  for (let index = 0; index < count; index += 1) {
    children[`f${index}`] = {
      id: `n${index}`,
      node: "field",
      name: `f${index}`,
      label: `Field ${index}`,
      fieldKind: "text",
      validators: [],
    };
  }
  return { ...project, schema: { ...project.schema, children } };
}

/** The cheapest of `attempts`, because one sample carries whatever the scheduler did during it. */
function best(run, attempts = 7) {
  let cheapest = Infinity;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const started = process.hrtime.bigint();
    run();
    const elapsed = Number(process.hrtime.bigint() - started) / 1e6;
    if (elapsed < cheapest) cheapest = elapsed;
  }
  return cheapest;
}

battle(
  {
    claims: ["STU-006"],
    title: "a command costs what it changes, not what the project holds",
    environments: ["node"],
  },
  async (ctx) => {
    const { createBlankProject } = await studio("studio-model");
    const { createRenameProjectCommand } = await studio("studio-editor");
    const project = projectOf(createBlankProject, 1000);

    // Warm both paths before either is timed: the first structured clone of a process compiles the
    // walk, and a cold first sample is how a timing battle passes for the wrong reason.
    structuredClone(project);
    createRenameProjectCommand("warm").apply(project);

    const clone = best(() => structuredClone(project));
    const rename = best(() => createRenameProjectCommand("a different name").apply(project));
    ctx.log.note("one thousand fields", { cloneMs: Number(clone.toFixed(3)), renameMs: Number(rename.toFixed(3)) });

    // The control on the measurement: copying this project is expensive enough to be measurable at
    // all. On a project too small to time, the ratio below would be noise against noise.
    expectClaim(clone > 0.05, {
      claimIds: ["STU-006"],
      what: "cloning the probe project is too cheap to measure, so the comparison below means nothing",
      detail: `${clone.toFixed(3)}ms for a whole-project clone`,
    });

    // And the property: changing one string is not the same work as copying every field. Half is a
    // wide margin — the measured difference is under two per cent — and it is a ratio between two
    // calls in one process, so a slower machine moves both.
    expectClaim(rename < clone / 2, {
      claimIds: ["STU-006"],
      what: "renaming a project costs what copying the whole project costs, so a command pays for the document rather than for its edit",
      detail: `rename ${rename.toFixed(3)}ms, whole-project clone ${clone.toFixed(3)}ms`,
    });
  },
);
