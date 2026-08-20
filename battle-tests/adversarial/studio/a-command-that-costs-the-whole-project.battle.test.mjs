/**
 * What one editorial command costs, against what it changes.
 *
 * A Studio command takes a project and returns the next one, and every one of them starts by copying
 * the project whole: `structuredClone(project)` appears thirty-six times in `commands.ts` alone. A
 * rename changes one string. A node update changes one node. Both pay for the whole document.
 *
 * The measurement that decides it is not growth — growth is what a machine's allocator does anyway.
 * It is **an edit against a bare clone, in the same process, at the same size**, on a thousand fields:
 *
 *     whole-project clone            0.725
 *     updateNode, one label          0.697   0.96x
 *     renameProject                  0.001   0.00x
 *
 * `updateNode` changes one string on one leaf of a thousand and pays 96% of copying all thousand. So
 * the cost of a command is **proportional to the project and independent of the edit** — a ratio
 * between two calls in one process rather than a threshold a slower machine could cross.
 *
 * `renameProject` is in the table as a **witness that the property is reachable**, not as a second
 * statement of it: it built its result as `{ ...structuredClone(project), name }`, where the spread
 * already makes the new top object and the deep clone under it duplicated every node to leave them
 * all identical. Removing it took that command to a rounding error, and no other command's cost
 * moved.
 *
 * In absolute terms this is not an interruption today: 0.7 ms per command on a thousand fields is
 * invisible, and a twenty-step history holding twenty copies is about 1.9 MB. It is a defect of
 * **scale** with a memory multiplier, and it becomes visible exactly where a small form never looks.
 *
 * Green when a command that changes one node costs materially less than copying the whole project.
 * The repair is a shape change — copy the path from the root to the touched node — so this battle
 * states the property and leaves the design to a record.
 *
 * **The command measured is not an example, it is the claim's whole surface.** An earlier form of
 * this battle timed `renameProject` alone. When that one command was repaired the battle went green
 * while seventeen others still copied the document, and the red that had been blocking a merge
 * stopped blocking it without the thing it described having changed. A property asked through one
 * example is a property about that example.
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

/**
 * A project of `count` flat fields, built through the model's own door.
 *
 * `children` is an **array** — `StudioSchemaNode[]` in the model's types. Built as an object keyed by
 * name it still clones at the same cost, so a measurement of the clone stays honest, but no command
 * that walks to a node finds one: `findNode` returns nothing and the walk being timed is a walk over
 * an empty tree. A probe whose project no command can act on measures the clone and calls it the
 * command.
 */
function projectOf(createBlankProject, count) {
  const project = createBlankProject();
  const children = [];
  for (let index = 0; index < count; index += 1) {
    children.push({
      id: `n${index}`,
      node: "field",
      name: `f${index}`,
      label: `Field ${index}`,
      fieldKind: "text",
      validators: [],
    });
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
    const { createRenameProjectCommand, createUpdateNodeCommand } = await studio("studio-editor");
    const project = projectOf(createBlankProject, 1000);

    const rename = createRenameProjectCommand("a different name");
    // One node of a thousand, and the cheapest edit there is on it: a label is a string on a leaf,
    // with no index to rebuild and no sibling to renumber. If any command's cost is allowed to be
    // about its edit, it is this one.
    const update = createUpdateNodeCommand("n500", { label: "Renamed" });

    // Warm every path before any is timed: the first structured clone of a process compiles the
    // walk, and a cold first sample is how a timing battle passes for the wrong reason.
    structuredClone(project);
    createRenameProjectCommand("warm").apply(project);
    update.apply(project);

    // The command has to have done something. `updateNode` walks to a node and patches it, and on a
    // project it cannot walk — a `children` of the wrong shape, an id that is not there — it throws
    // or it patches nothing, and a timing taken either side of that measures the clone alone.
    const patched = update.apply(project);
    const touched = patched.schema.children.find((child) => child.id === "n500");
    expectClaim(touched?.label === "Renamed", {
      claimIds: ["STU-006"],
      what: "the command under measurement reached the node it names",
      detail: `n500.label = ${JSON.stringify(touched?.label)}`,
    });

    const clone = best(() => structuredClone(project));
    const renameMs = best(() => rename.apply(project));
    const updateMs = best(() => update.apply(project));
    ctx.log.note("one thousand fields", {
      cloneMs: Number(clone.toFixed(3)),
      renameMs: Number(renameMs.toFixed(3)),
      updateNodeMs: Number(updateMs.toFixed(3)),
      updateOverClone: Number((updateMs / clone).toFixed(2)),
    });

    // The control on the measurement: copying this project is expensive enough to be measurable at
    // all. On a project too small to time, the ratios below would be noise against noise.
    expectClaim(clone > 0.05, {
      claimIds: ["STU-006"],
      what: "cloning the probe project is too cheap to measure, so the comparison below means nothing",
      detail: `${clone.toFixed(3)}ms for a whole-project clone`,
    });

    // A witness that the property is reachable, not a second statement of it.
    //
    // `renameProject` built its result as `{ ...structuredClone(project), name }` — the spread
    // already makes the new top object, so the deep clone under it duplicated every node to leave
    // them all identical. Removing it took the command to a rounding error. That is what makes this
    // battle's own history worth carrying: with only this command measured, the battle went green
    // while seventeen others still paid for the whole document. **A property asserted through one
    // example is a property about that example.**
    expectClaim(renameMs < clone / 2, {
      claimIds: ["STU-006"],
      what: "a command that changes one string can cost less than copying the project, so the property is reachable and not a wish",
      detail: `rename ${renameMs.toFixed(3)}ms, whole-project clone ${clone.toFixed(3)}ms`,
    });

    // And the property itself, asked of a command that touches a node. Half is a wide margin — the
    // measured difference is around one per cent — and it is a ratio between two calls in one
    // process, so a slower machine moves both.
    expectClaim(updateMs < clone / 2, {
      claimIds: ["STU-006"],
      what: "changing one node's label costs what copying every node costs, so a command pays for the document rather than for its edit",
      detail: `updateNode ${updateMs.toFixed(3)}ms, whole-project clone ${clone.toFixed(3)}ms, ${(updateMs / clone).toFixed(2)}x`,
    });
  },
);
