/**
 * The same document, judged by an editor and by the engine.
 *
 * `@modyra/eslint-plugin` states its own contract in one sentence: "The findings are the parser's.
 * This package positions them; it does not decide them." That is a differential claim — two public
 * paths answering one question — and nothing compared them. `audit-contract-schema` holds the JSON
 * schema to the parser and never mentions the linter.
 *
 * A rule that decided anything separately would agree with the parser only until the next release,
 * and the failure is quiet in the worst direction: an author trusts a clean editor and ships a
 * document that will not render.
 *
 * The other half of the contract is the refusal. `static-value` reads syntax only — an identifier, a
 * call, a spread is unknown rather than followed, because the rules run in an editor over whatever
 * repository is open and a reconstruction that ran code would execute a stranger's source on file
 * open. So the whole document is refused when any part of it is unknown, deliberately: a half-known
 * one produces findings about absences that are not absences, and one false report is enough for a
 * consumer to switch the rule off. That silence is the contract, so it is asserted rather than
 * mistaken for a miss.
 *
 * Neither package is linked into the workspace root, so both are reached the way a consumer reaches
 * them: packed, then installed into a project that has never seen this repository, with eslint
 * beside them.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const REPO = resolve(HERE, "..", "..", "..");

/**
 * Documents whose defects the parser has an opinion about, each written as a source literal.
 *
 * `source` is what an author types; `document` is the same thing as data. The two are kept side by
 * side on purpose — the comparison is between what the editor says about the first and what the
 * engine says about the second.
 */
const CORPUS = `
const CASES = [
  {
    name: "a document with nothing wrong with it",
    source: 'const doc = { version: 3, fields: [ { name: "a", kind: "text" } ] };',
    document: { version: 3, fields: [{ name: "a", kind: "text" }] },
  },
  {
    name: "two fields with one name",
    source: 'const doc = { version: 3, fields: [ { name: "a", kind: "text" }, { name: "a", kind: "text" } ] };',
    document: { version: 3, fields: [{ name: "a", kind: "text" }, { name: "a", kind: "text" }] },
  },
  {
    name: "a kind nothing renders",
    source: 'const doc = { version: 3, fields: [ { name: "a", kind: "wormhole" } ] };',
    document: { version: 3, fields: [{ name: "a", kind: "wormhole" }] },
  },
  {
    name: "a name that is a path into something else",
    source: 'const doc = { version: 3, fields: [ { name: "__proto__", kind: "text" } ] };',
    document: { version: 3, fields: [{ name: "__proto__", kind: "text" }] },
  },
  {
    name: "a select with no options",
    source: 'const doc = { version: 3, fields: [ { name: "a", kind: "select" } ] };',
    document: { version: 3, fields: [{ name: "a", kind: "select" }] },
  },
];
`;

/** Lint each source and parse each document, in the consumer that has both installed. */
const COMPARE = `
${CORPUS}
import { Linter } from "eslint";
import { parseDynamicForm } from "@modyra/core";
const loaded = await import("@modyra/eslint-plugin");
const plugin = loaded.default ?? loaded;

const linter = new Linter();
const config = [{ plugins: { modyra: plugin }, rules: { "modyra/valid-dynamic-form": "error" } }];

/** A finding reduced to its code, which is the part both sides agree to speak in. */
const codesFrom = (messages) =>
  messages
    .map((each) => (each.match(/\\(([A-Z_]+)\\)\\s*$/) ?? [])[1] ?? each)
    .sort();

const out = CASES.map((each) => ({
  name: each.name,
  fromEditor: codesFrom(linter.verify(each.source, config, "doc.mjs").map((m) => m.message)),
  fromEngine: parseDynamicForm(each.document).diagnostics.map((d) => d.code).sort(),
}));

// The refusal: the same defect, with one part of the document written as something syntax cannot
// state. The rule must say nothing at all rather than judge a document it could not rebuild.
const dynamic = [
  'const extra = { name: "a", kind: "text" };\\nconst doc = { version: 3, fields: [ { name: "a", kind: "text" }, { ...extra } ] };',
  'const dup = "a";\\nconst doc = { version: 3, fields: [ { name: "a", kind: "text" }, { name: dup, kind: "text" } ] };',
  'const doc = { version: 3, fields: [ { name: "a", kind: "text" }, { name: build(), kind: "text" } ] };',
];
const whenUnknown = dynamic.map((source) => linter.verify(source, config, "doc.mjs").map((m) => m.message));

// Where a finding lands. A document written over several lines, with one defect, on a line this
// battle knows — so "reported" can be told apart from "reported where the reader has to look".
const ANCHORED = [
  {
    name: "a duplicate name, three fields down",
    defectOn: 6,
    source: [
      'const doc = {',
      '  version: 3,',
      '  fields: [',
      '    { name: "alpha", kind: "text" },',
      '    { name: "beta", kind: "text" },',
      '    { name: "alpha", kind: "text" },',
      '  ],',
      '};',
    ].join("\\n"),
  },
  {
    name: "a kind nobody declared, deep in the list",
    defectOn: 7,
    source: [
      'const doc = {',
      '  version: 3,',
      '  fields: [',
      '    { name: "a", kind: "text" },',
      '    { name: "b", kind: "text" },',
      '    { name: "c", kind: "text" },',
      '    { name: "d", kind: "wormhole" },',
      '  ],',
      '};',
    ].join("\\n"),
  },
  {
    name: "a name that is a path, on the last field",
    defectOn: 6,
    source: [
      'const doc = {',
      '  version: 3,',
      '  fields: [',
      '    { name: "a", kind: "text" },',
      '    { name: "b", kind: "text" },',
      '    { name: "__proto__", kind: "text" },',
      '  ],',
      '};',
    ].join("\\n"),
  },
];

const anchors = ANCHORED.map((each) => ({
  name: each.name,
  defectOn: each.defectOn,
  lines: linter.verify(each.source, config, "doc.mjs").map((m) => m.line),
  totalLines: each.source.split("\\n").length,
}));

console.log(JSON.stringify({ out, whenUnknown, anchors }));
`;

/** Pack both packages, install them with eslint, and run the comparison inside. */
function compareInConsumer() {
  const work = mkdtempSync(join(tmpdir(), "mdy-linter-"));
  try {
    const tarballs = [];
    for (const pkg of ["core", "eslint-plugin"]) {
      execFileSync("npm", ["pack", "--pack-destination", work, "--silent"], {
        cwd: join(REPO, "packages", pkg),
        stdio: ["ignore", "ignore", "pipe"],
      });
    }
    for (const name of readdirSync(work)) {
      if (name.endsWith(".tgz")) tarballs.push(join(work, name));
    }

    const consumer = join(work, "consumer");
    mkdirSync(consumer, { recursive: true });
    writeFileSync(join(consumer, "package.json"), `${JSON.stringify({ name: "c", private: true, type: "module" })}\n`);
    execFileSync("npm", ["install", ...tarballs, "eslint", "--silent", "--no-audit", "--no-fund"], {
      cwd: consumer,
      stdio: ["ignore", "ignore", "pipe"],
    });

    writeFileSync(join(consumer, "compare.mjs"), COMPARE, "utf8");
    const stdout = execFileSync(process.execPath, [join(consumer, "compare.mjs")], {
      cwd: consumer,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ran: true, ...JSON.parse(stdout.trim()) };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

battle(
  {
    claims: ["DYN-003"],
    title: "an editor reports what the engine reports, and nothing of its own",
    environments: ["node"],
  },
  async (ctx) => {
    const result = compareInConsumer();
    ctx.log.note("the same documents judged twice", { cases: result.out?.length });

    expectClaim(result.ran === true, {
      claimIds: ["DYN-003"],
      what: "the packages could not be packed and installed together",
    });

    // The control: the corpus has to contain something both sides object to, or "they agree" is a
    // statement about two silences.
    const objections = result.out.filter((each) => each.fromEngine.length > 0);
    expectClaim(objections.length >= 3, {
      claimIds: ["DYN-003"],
      what: "the corpus gave the engine too little to object to",
      detail: JSON.stringify(result.out.map((each) => [each.name, each.fromEngine])),
    });

    for (const each of result.out) {
      ctx.log.note("one document, two judgements", each);
      expectEqual(each.fromEditor, each.fromEngine, {
        claimIds: ["DYN-003"],
        what: `the editor and the engine disagreed about ${JSON.stringify(each.name)}`,
      });
    }

    // And the refusal, which is the contract rather than a gap: a document with a part syntax
    // cannot state is not judged at all, because half-judging one produces findings about absences
    // that are not absences.
    for (const [index, messages] of result.whenUnknown.entries()) {
      expectEqual(messages, [], {
        claimIds: ["DYN-003"],
        what: `a document whose defect is written dynamically was judged anyway (case ${index})`,
      });
    }
  },
);

battle(
  {
    claims: ["DYN-003"],
    title: "a finding lands on the thing it is about",
    environments: ["node"],
  },
  async (ctx) => {
    // Codes travelling faithfully is half of what an editor adds. The other half is *where*: a
    // linter that puts every finding on the same line has told the reader nothing they could not
    // get from the console, and a document assembled by a CMS is long.
    //
    // The plugin does its part — `resolvePath` walks the literal as far as the diagnostic's path
    // reaches and underlines the deepest node it got to. What it is given is `/fields` for every
    // finding, so it underlines the array and the reader is sent to the line where the list opens
    // whichever entry is wrong.
    //
    // So this is a claim about the *path a diagnostic carries*, not about the rule. A finding that
    // named its entry would land on it with nothing in the plugin changing.
    const result = compareInConsumer();
    ctx.log.note("linting documents whose defect is on a known line", {
      cases: result.anchors?.length ?? 0,
    });

    expectClaim(result.ran === true, {
      claimIds: ["DYN-003"],
      what: "the packages could not be packed and installed together",
    });

    ctx.log.note("where each finding landed", { anchors: result.anchors });

    // The controls first, so the comparison below is between two meaningful numbers.
    for (const each of result.anchors) {
      // Exactly one finding, or "the" finding is a choice this battle would be making.
      expectEqual(each.lines.length, 1, {
        claimIds: ["DYN-003"],
        what: `${each.name} produced ${each.lines.length} findings, so this battle cannot say where the finding landed`,
        detail: JSON.stringify(each),
      });

      // And the defect is never the first or last line, so landing on the document root cannot
      // pass by coincidence.
      expectClaim(each.defectOn > 1 && each.defectOn < each.totalLines, {
        claimIds: ["DYN-003"],
        what: `${each.name} puts its defect at the edge of the document, where landing on the root would pass`,
        detail: JSON.stringify(each),
      });
    }

    // Every case at once rather than the first that fails, because where the anchor *does* land is
    // most of what a fix needs to know.
    const misplaced = result.anchors
      .filter((each) => each.lines[0] !== each.defectOn)
      .map((each) => ({ case: each.name, reportedOn: each.lines[0], writtenOn: each.defectOn }));

    expectEqual(misplaced, [], {
      claimIds: ["DYN-003"],
      what: "a finding was reported on a line other than the one its defect is written on",
      detail: JSON.stringify({ misplaced, anchors: result.anchors }),
    });
  },
);
