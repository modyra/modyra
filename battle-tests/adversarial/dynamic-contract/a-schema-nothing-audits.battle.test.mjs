/**
 * A published schema that no gate reads.
 *
 * H-3 of `charter/fable5-hunts.md` states the green condition in its own words: *"a v4 schema exists,
 * the audit covers it, and a differential campaign finds no residue."* The first is done —
 * `spec/dynamic-form-v4.schema.json` was published with the contract's v4 slots. The second is not.
 *
 * `npm run test:contract-schema` names what it read, and the list is one short:
 *
 *   Schemas: spec/dynamic-form-v2.schema.json, spec/dynamic-form-v3.schema.json
 *   Document slots read from the type: version, id, fields, schema, layout, rules, validations
 *   CONTRACT SCHEMA CLEAN
 *
 * It reports clean while leaving a published schema unread, and the slot list it prints has no
 * `requiresContext` — the member v4 adds, and the one that decides whether a host can supply what a
 * document's conditions read.
 *
 * `spec/fixtures/dynamic-form/` holds `v2` and `v3` and no `v4`, which reaches further than this
 * audit: those fixtures are what H-6 uses to prove the Rust and Java SDKs agree with the TypeScript
 * interpreter. A version with no fixtures is a version the other two runtimes have nothing to be
 * measured against.
 *
 * The assertion is the one the charter states: **every schema published under `spec/` is one the
 * audit reads.** It says nothing about what the audit should conclude, only that a schema shipped to
 * `https://modyra.dev/schemas/` is not outside the gate that exists for schemas.
 *
 * The audit is run rather than read: it is a published command of this project, and what it prints is
 * its answer.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const REPO = resolve(dirname(new URL(import.meta.url).pathname), "..", "..", "..");
const SPEC = join(REPO, "spec");
const FIXTURES = join(SPEC, "fixtures", "dynamic-form");

/** Every version this repository publishes a schema for. */
function publishedVersions() {
  return readdirSync(SPEC)
    .map((entry) => /^dynamic-form-v(\d+)\.schema\.json$/.exec(entry))
    .filter((match) => match !== null)
    .map((match) => Number(match[1]))
    .sort((a, b) => a - b);
}

/** What the audit says it read, taken from its own output. */
function versionsTheAuditReads() {
  const output = execFileSync("npm", ["run", "--silent", "test:contract-schema"], {
    cwd: REPO,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  const line = output.split("\n").find((each) => each.startsWith("Schemas:")) ?? "";
  return {
    versions: [...line.matchAll(/dynamic-form-v(\d+)\.schema\.json/g)].map((match) => Number(match[1])).sort((a, b) => a - b),
    output,
  };
}

battle(
  {
    claims: ["DYN-004", "DYN-003"],
    title: "every published schema is one the audit reads",
    environments: ["node"],
  },
  async (ctx) => {
    const published = publishedVersions();
    const { versions: audited, output } = versionsTheAuditReads();
    const withFixtures = published.filter((version) => existsSync(join(FIXTURES, `v${version}`)));
    ctx.log.note("published schemas, audited schemas, and fixtures", { published, audited, withFixtures });

    // The instrument: schemas exist, the audit read at least one of them, and it reported a verdict.
    // Without this, "the lists differ" could describe an audit that failed to run.
    expectClaim(
      published.length >= 2 && audited.length >= 1 && output.includes("CONTRACT SCHEMA"),
      {
        claimIds: ["DYN-003"],
        what: "the audit did not run or read nothing, so the probe is wrong before the contract is",
        detail: JSON.stringify({ published, audited, tail: output.slice(-120) }),
      },
    );

    expectEqual(
      published.filter((version) => !audited.includes(version)),
      [],
      {
        claimIds: ["DYN-004", "DYN-003"],
        what: "a schema published under spec/ is not one the schema audit reads, and the audit reports clean without it",
      },
    );

    // And the half that reaches the other runtimes: a version with no fixtures is one the Rust and
    // Java SDKs have nothing to be measured against.
    expectEqual(
      published.filter((version) => !withFixtures.includes(version)),
      [],
      {
        claimIds: ["DYN-003"],
        what: "a published version has no shared fixtures, so the cross-SDK differential has nothing to compare for it",
      },
    );
  },
);
