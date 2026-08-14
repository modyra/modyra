/**
 * The guard that a second copy of the package turns off.
 *
 * `reactive-owner.ts` keeps a registry of which runtime owns which handle, and its docblock says
 * what it is for: every consumer handed a handle answered the same wrong way — build a fresh
 * `vanillaReactivity()` — which "works by accident and stops working the moment the handle belongs
 * to another adapter's form, silently, because nothing re-renders and nothing complains". The
 * registry is a module-level `WeakMap`, and `observerFor` reports a mismatch against it.
 *
 * A module-level map is per module *instance*. Two copies of `@modyra/core` in one dependency tree
 * are two registries, and a handle registered in one is unknown to the other — so `observerFor`,
 * which only reports when it can see an owner that differs from the runtime it was handed, sees no
 * owner at all and reports nothing. The consumer gets the runtime they passed, which is the defect
 * the registry exists to catch, with the diagnostic removed.
 *
 * Two copies is not a hypothetical shape. It is what a package manager builds whenever two
 * dependents need versions that cannot be deduplicated, which is the ordinary state of a tree partway
 * through an upgrade — and it is exactly the case `PKG-001` names: a packed consumer observing
 * something a workspace test cannot.
 *
 * The tree is built rather than described: both packages are packed and installed into a project
 * that has never seen this repository, and a second core is placed where a resolver would put it.
 */

import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const REPO = resolve(HERE, "..", "..", "..");

/** What the consumer runs once both copies are in place. */
const PROBE = `
import { pathToFileURL } from "node:url";
import { join } from "node:path";

const top = await import("@modyra/core");
const nested = await import(
  pathToFileURL(join(process.cwd(), "node_modules/@modyra/widgets/node_modules/@modyra/core/dist/index.js")).href
);

const form = top.createForm({ a: top.field("x") }, { reactivity: top.vanillaReactivity(), devWarnings: false });
const handle = form.f.a;

/** Run something with the console captured, without losing this script's own output. */
const withConsole = (run) => {
  const said = [];
  const real = console.warn;
  console.warn = (...parts) => said.push(parts.join(" "));
  try { return { value: run(), said }; } finally { console.warn = real; }
};

const ownerFromTop = withConsole(() => top.getFieldHandleOwner(handle));
const ownerFromNested = withConsole(() => nested.getFieldHandleOwner(handle));

// The mismatch the registry exists to report: a handle owned by one runtime, observed through
// another. Asked of each copy, with a runtime that is not the owner.
const throughTop = withConsole(() => top.observerFor(handle, top.vanillaReactivity()));
const throughNested = withConsole(() => nested.observerFor(handle, nested.vanillaReactivity()));

console.log(JSON.stringify({
  distinctInstances: top !== nested,
  sameCreateForm: top.createForm === nested.createForm,
  ownerFromTop: ownerFromTop.value ? ownerFromTop.value.kind : null,
  ownerFromNested: ownerFromNested.value ? ownerFromNested.value.kind : null,
  saidByTop: throughTop.said,
  saidByNested: throughNested.said,
}));
form.destroy();
`;

/** Pack core and widgets, install them, place a second core where a resolver would, and probe. */
function probeDuplicatedTree() {
  const work = mkdtempSync(join(tmpdir(), "mdy-dup-"));
  try {
    for (const pkg of ["core", "widgets"]) {
      execFileSync("pnpm", ["pack", "--pack-destination", work], {
        cwd: join(REPO, "packages", pkg),
        stdio: ["ignore", "ignore", "pipe"],
      });
    }
    const tarballs = readdirSync(work).filter((name) => name.endsWith(".tgz")).map((name) => join(work, name));

    const consumer = join(work, "consumer");
    mkdirSync(consumer, { recursive: true });
    writeFileSync(join(consumer, "package.json"), `${JSON.stringify({ name: "c", private: true, type: "module" })}\n`);
    execFileSync("npm", ["install", ...tarballs, "--silent", "--no-audit", "--no-fund"], {
      cwd: consumer,
      stdio: ["ignore", "ignore", "pipe"],
    });

    // The shape a package manager builds when two dependents cannot share one core.
    const nested = join(consumer, "node_modules", "@modyra", "widgets", "node_modules", "@modyra");
    mkdirSync(nested, { recursive: true });
    cpSync(join(consumer, "node_modules", "@modyra", "core"), join(nested, "core"), { recursive: true });

    writeFileSync(join(consumer, "probe.mjs"), PROBE, "utf8");
    const stdout = execFileSync(process.execPath, [join(consumer, "probe.mjs")], {
      cwd: consumer,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ran: true, ...JSON.parse(stdout.trim()) };
  } catch (error) {
    return { ran: false, message: `${error.stderr ?? error.message}`.split("\n").slice(0, 2).join(" ") };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

battle(
  {
    claims: ["PKG-001", "REA-002"],
    title: "a second copy of the package does not turn the cross-runtime guard off",
    environments: ["node"],
  },
  async (ctx) => {
    const result = probeDuplicatedTree();

    try {
      expectClaim(result.ran === true, {
        claimIds: ["PKG-001"],
        what: "the packages could not be packed and installed",
        detail: result.message ?? "",
      });

      ctx.log.note("a consumer holding two copies of the engine", {
        distinctInstances: result.distinctInstances,
        ownerFromTop: result.ownerFromTop,
        ownerFromNested: result.ownerFromNested,
        saidByTop: result.saidByTop,
        saidByNested: result.saidByNested,
      });

      // The control: the tree really does hold two module instances, or everything below is about
      // one copy talking to itself.
      expectClaim(result.distinctInstances === true && result.sameCreateForm === false, {
        claimIds: ["PKG-001"],
        what: "the consumer resolved one copy, so this battle did not build the tree it describes",
        detail: JSON.stringify(result),
      });

      // The second control: the copy that registered the handle can still see its owner, so a
      // failure below is the *other* copy rather than the registry not working at all.
      expectEqual(result.ownerFromTop, "vanilla", {
        claimIds: ["REA-002"],
        what: "the copy that created the handle cannot see its owner, which is a wider failure than the one under test",
        detail: JSON.stringify(result),
      });

      // And the copy that did not register it. A handle whose owner cannot be seen is a handle the
      // mismatch check skips — `observerFor` reports only when it can compare an owner against the
      // runtime it was handed.
      expectEqual(result.ownerFromNested, "vanilla", {
        claimIds: ["PKG-001", "REA-002"],
        what: "a second copy of the engine does not recognise a handle the first one owns",
        detail: JSON.stringify(result),
      });

      // The consequence, stated separately because a fix could restore the diagnostic without
      // sharing the registry: whichever copy is asked, being handed a runtime that is not the owner
      // has to say so.
      expectClaim(result.saidByNested.length > 0, {
        claimIds: ["REA-002"],
        what: "a foreign runtime observed through the second copy produced no diagnostic at all",
        detail: JSON.stringify({ top: result.saidByTop, nested: result.saidByNested }),
      });
    } finally {
      // The prober removes its own working directory.
    }
  },
);
