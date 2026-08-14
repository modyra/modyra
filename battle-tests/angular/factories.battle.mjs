/**
 * The Angular adapter's own factories, reached the way a consumer reaches them.
 *
 * `@modyra/angular` is the one published package this suite could not open. It is not linked into
 * the workspace root, and importing it from the repository runs Angular's JIT compiler before any
 * test gets a say. So it is packed from its `ng-packagr` output — exactly as `publish-angular.mjs`
 * does — and installed into a project with real Angular peers, where `@angular/compiler` loaded
 * first is what makes the published bundle importable. That is a consumer's path, not a shortcut.
 *
 * What is attacked is the thing that broke and that no suite saw: the adapter re-exports its own
 * `array`, `record`, `group` and `field`, and those refused a collection as a row long after the
 * engine stopped refusing one. A Studio project with a nested collection generated Angular code
 * that did not compile, and every nested test in the workspace was keyed at every level, so nothing
 * caught it. The engine agreeing is not the adapter agreeing.
 *
 * It has a tier of its own for the same reason the browser battles do: it needs an artefact the
 * default run does not build. `npm run battle:angular` builds `packages/angular/dist` first, and the
 * file is deliberately not named `*.test.mjs` so the default glob leaves it alone rather than going
 * red in CI over a missing build. The precondition is still asserted inside, because a check that
 * reports green without having run is worse than one that is missing.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { battle } from "../harness/battle.mjs";
import { expectClaim, expectEqual } from "../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const REPO = resolve(HERE, "..", "..");
const ANGULAR_DIST = join(REPO, "packages", "angular", "dist");

/** Angular's own peers, at the range the packed manifest asks for. */
const PEERS = Object.freeze([
  "@angular/core@>=21.2.19",
  "@angular/common@>=21.2.19",
  "@angular/platform-browser@>=21.2.19",
  "@angular/forms@>=21.2.19",
  "@angular/compiler@>=21.2.19",
  "rxjs",
  "zone.js",
]);

/**
 * Build each nesting through the adapter's factories, then drive the result.
 *
 * The factories are the subject; `createForm` comes from the engine because what is under test is
 * whether the adapter's descriptors are ones the engine accepts, not whether the engine works.
 */
const SCENARIO = `
import "@angular/compiler";
const ng = await import("@modyra/angular");
const core = await import("@modyra/core");

const built = {};
const attempt = (name, make) => {
  try { built[name] = { ok: true, descriptor: !!make() }; }
  catch (error) { built[name] = { ok: false, message: String(error.message).slice(0, 120) }; }
};

attempt("array of leaves", () => ng.array(ng.field("")));
attempt("array of groups", () => ng.array(ng.group({ a: ng.field("") })));
attempt("array inside an array's row", () => ng.array(ng.group({ inner: ng.array(ng.group({ v: ng.field("") })) })));
attempt("record inside an array's row", () => ng.array(ng.group({ tags: ng.record(ng.group({ n: ng.field("") })) })));
attempt("array inside a record's row", () => ng.record(ng.group({ lines: ng.array(ng.group({ sku: ng.field("") })) })));

// And the descriptors have to be ones the engine can actually run, not merely ones it accepted.
let driven = null;
try {
  const form = core.createForm(
    { outer: ng.array(ng.group({ inner: ng.array(ng.group({ v: ng.field("") })) })) },
    { devWarnings: false },
  );
  form.f.outer.push({ inner: [{ v: "1" }] });
  form.f.outer.push({ inner: [] });
  form.f.outer.at(0).inner.push({ v: "2" });
  form.f.outer.move(0, 1);
  driven = form.getValue();
  form.destroy();
} catch (error) {
  driven = { raised: String(error.message).slice(0, 120) };
}

console.log(JSON.stringify({ built, driven, exports: Object.keys(ng).length }));
`;

/** Pack the adapter and its engine, install with Angular's peers, and run the scenario inside. */
function runInConsumer() {
  const work = mkdtempSync(join(tmpdir(), "mdy-angular-"));
  try {
    for (const dir of [ANGULAR_DIST, join(REPO, "packages", "core"), join(REPO, "packages", "widgets")]) {
      execFileSync("npm", ["pack", "--pack-destination", work, "--silent"], {
        cwd: dir,
        stdio: ["ignore", "ignore", "pipe"],
      });
    }
    const tarballs = readdirSync(work)
      .filter((name) => name.endsWith(".tgz"))
      .map((name) => join(work, name));

    const consumer = join(work, "consumer");
    mkdirSync(consumer, { recursive: true });
    writeFileSync(join(consumer, "package.json"), `${JSON.stringify({ name: "c", private: true, type: "module" })}\n`);

    // Errors are not silenced: an install that failed quietly is how this battle first "passed"
    // against an empty node_modules.
    execFileSync("npm", ["install", ...tarballs, ...PEERS, "--no-audit", "--no-fund"], {
      cwd: consumer,
      stdio: ["ignore", "ignore", "pipe"],
    });

    writeFileSync(join(consumer, "scenario.mjs"), SCENARIO, "utf8");
    const stdout = execFileSync(process.execPath, [join(consumer, "scenario.mjs")], {
      cwd: consumer,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return JSON.parse(stdout.trim());
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

battle(
  {
    claims: ["COL-001", "DYN-002"],
    title: "the Angular adapter's factories accept the nesting the engine runs",
    environments: ["angular"],
  },
  async (ctx) => {
    // The precondition, stated rather than skipped. `build:angular` produces this and `npm run
    // battle` does not, so a run without it says which command is missing instead of going green.
    expectClaim(existsSync(ANGULAR_DIST), {
      claimIds: ["COL-001"],
      what: "the Angular build output is not there — run `npm run build:angular` before this tier",
      detail: ANGULAR_DIST,
    });

    const result = runInConsumer();
    ctx.log.note("the adapter's factories, from an installed package", {
      exports: result.exports,
      built: Object.fromEntries(Object.entries(result.built).map(([name, each]) => [name, each.ok])),
    });

    // The control: the package really loaded. A consumer that resolved nothing would report every
    // factory as failing for a reason that has nothing to do with nesting.
    expectClaim(result.exports > 50, {
      claimIds: ["COL-001"],
      what: "the installed adapter exported almost nothing, so nothing below is about nesting",
      detail: `${result.exports} export(s)`,
    });

    for (const [name, outcome] of Object.entries(result.built)) {
      expectClaim(outcome.ok === true, {
        claimIds: ["COL-001", "DYN-002"],
        what: `the adapter refused ${JSON.stringify(name)}`,
        detail: outcome.message ?? "",
      });
    }

    // Accepting the descriptor is not the claim; running it is. A row that moves has to take its
    // nested list with it, through descriptors the adapter built rather than the engine.
    expectEqual(result.driven, { outer: [{ inner: [] }, { inner: [{ v: "1" }, { v: "2" }] }] }, {
      claimIds: ["COL-001", "DYN-002"],
      what: "a form built from the adapter's descriptors did not hold what it was driven to hold",
    });
  },
);
