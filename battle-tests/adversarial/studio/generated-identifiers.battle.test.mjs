/**
 * A project name that becomes a declaration the language refuses.
 *
 * Studio generates a module of stubs a consumer then compiles, and the name of each stub comes from
 * what someone typed into the editor. `buildStubsModule` decides between the typed name and a
 * sanitized one with `isValidIdentifier`, and every name it accepts is emitted as written:
 *
 *     export function <name>(value: unknown): readonly MdyFormError[] { … }
 *
 * `isValidIdentifier` answers about the *shape* of an identifier — a letter or `_`/`$` followed by
 * letters, digits, `_` and `$`. Every reserved word has that shape. So an implementation called
 * `class`, `default`, `import`, `return`, `new`, `typeof`, `let`, `const`, `enum`, `function`,
 * `await`, `yield` or `static` is emitted unchanged and the generated module does not compile.
 *
 * Nothing about that is exotic. `default` is what someone calls the fallback rule, `import` the one
 * that runs on an imported row, `new` the one for a new record — these are the words a domain uses.
 *
 * The names it *rejects* are handled correctly, which is what makes this a gap rather than an absent
 * feature: `with space` becomes `with_space`, `2legit` becomes `_2legit`. The sanitizer exists and
 * works; it is the question asked before it that is too narrow.
 *
 * Compilability is asked of the language rather than of a rule about which words are reserved: each
 * emitted name is written into a module as a declaration and parsed. A list of keywords in this file
 * would be one more thing to keep current, and the parser already knows.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const REPO = resolve(HERE, "..", "..", "..");

/** Names a person types into an editor, and what each is: ordinary, reserved, or unshaped. */
const NAMES = Object.freeze([
  "myCheck", "validateTotal",
  "class", "default", "import", "return", "new", "typeof", "let", "const", "enum", "function",
  "await", "yield", "static",
  "with space", "2legit", "café",
]);

/** Build the stub module for each name, in a consumer that installed the packed packages. */
const GENERATE = `
import { buildStubsModule } from "@modyra/studio-codegen";

const NAMES = ${JSON.stringify(NAMES)};
const emitted = NAMES.map((displayName) => {
  const project = { implementations: { i1: { id: "impl-0001", displayName, role: "validator" } } };
  const { code } = buildStubsModule(project);
  return { displayName, name: (code.match(/export function ([^(]*)\\(/) ?? [])[1] ?? null, code };
});
console.log(JSON.stringify(emitted));
`;

/**
 * Pack studio-codegen with its workspace dependency, install both, and generate inside.
 *
 * `pnpm pack` rather than `npm pack`: studio-codegen depends on studio-model as `workspace:*`, and
 * only pnpm rewrites that to the version it resolved. An npm tarball carries the protocol into the
 * manifest and refuses to install — which is what a consumer would meet, and is why the packing tool
 * is part of what this battle depends on rather than an implementation detail of it.
 */
function runInConsumer(script) {
  const work = mkdtempSync(join(tmpdir(), "mdy-studio-"));
  try {
    for (const pkg of ["studio-model", "studio-codegen", "studio-target-core", "studio-contract", "studio-editor"]) {
      execFileSync("pnpm", ["pack", "--pack-destination", work], {
        cwd: join(REPO, "packages", pkg),
        stdio: ["ignore", "ignore", "pipe"],
      });
    }
    const tarballs = readdirSync(work)
      .filter((name) => name.endsWith(".tgz"))
      .map((name) => join(work, name));

    const consumer = join(work, "consumer");
    mkdirSync(consumer, { recursive: true });
    writeFileSync(join(consumer, "package.json"), `${JSON.stringify({ name: "c", private: true, type: "module" })}\n`);
    execFileSync("npm", ["install", ...tarballs, "--silent", "--no-audit", "--no-fund"], {
      cwd: consumer,
      stdio: ["ignore", "ignore", "pipe"],
    });

    writeFileSync(join(consumer, "run.mjs"), script, "utf8");
    const stdout = execFileSync(process.execPath, [join(consumer, "run.mjs")], {
      cwd: consumer,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ran: true, out: JSON.parse(stdout.trim()), work };
  } catch (error) {
    return { ran: false, message: `${error.stderr ?? error.message}`.split("\n").slice(0, 2).join(" ") };
  } finally {
    // The consumer is removed by the caller once the names have been checked, so a temporary
    // module can be written beside it.
  }
}

/**
 * Whether `name` can be a function declaration in an ES module.
 *
 * Asked of the parser rather than of a list of keywords kept in this file: module semantics differ
 * from script semantics for `await`, and a list would be one more thing to keep current.
 */
function compilesAsADeclaration(name, scratch) {
  const file = join(scratch, `n${Buffer.from(name).toString("hex")}.mjs`);
  writeFileSync(file, `export function ${name}() {}\n`, "utf8");
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

battle(
  {
    claims: ["STU-001"],
    title: "every name a project can carry is emitted as something the language accepts",
    environments: ["node"],
  },
  async (ctx) => {
    const result = { ...runInConsumer(GENERATE) };
    result.emitted = result.out;
    const scratch = mkdtempSync(join(tmpdir(), "mdy-ident-"));

    try {
      expectClaim(result.ran === true, {
        claimIds: ["STU-001"],
        what: "studio-codegen could not be packed and installed",
        detail: result.message ?? "",
      });

      const checked = result.emitted.map((each) => ({
        ...each,
        compiles: each.name === null ? null : compilesAsADeclaration(each.name, scratch),
      }));
      ctx.log.note("what each project name was emitted as", {
        emitted: checked.map((each) => [each.displayName, each.name, each.compiles]),
      });

      // The control: a name that is already an identifier is emitted unchanged and compiles, so the
      // failures below are the names rather than the generator emitting nothing usable.
      const ordinary = checked.find((each) => each.displayName === "myCheck");
      expectClaim(ordinary?.name === "myCheck" && ordinary.compiles === true, {
        claimIds: ["STU-001"],
        what: "an ordinary name did not survive generation, so nothing below measures the hostile ones",
        detail: JSON.stringify(ordinary),
      });

      // The second control: the sanitizer works. Names that are not identifier-shaped are repaired,
      // so this is a gap in the question asked before it rather than a missing feature.
      const repaired = checked.filter((each) => ["with space", "2legit", "café"].includes(each.displayName));
      expectClaim(repaired.every((each) => each.compiles === true), {
        claimIds: ["STU-001"],
        what: "the sanitizer does not produce a usable name, which is a wider failure than the one under test",
        detail: JSON.stringify(repaired.map((each) => [each.displayName, each.name])),
      });

      const refused = checked
        .filter((each) => each.compiles === false)
        .map((each) => ({ typed: each.displayName, emitted: each.name }));

      expectEqual(refused, [], {
        claimIds: ["STU-001"],
        what: "a project name was emitted as a declaration the language refuses, so the generated module does not compile",
        detail: JSON.stringify(refused),
      });
    } finally {
      rmSync(scratch, { recursive: true, force: true });
      if (result.work) rmSync(result.work, { recursive: true, force: true });
    }
  },
);

/**
 * Compile one condition per operand, through the loader a project file passes.
 *
 * The operands are built in the consumer rather than sent as JSON so that an object and an array
 * arrive as themselves; both are outside `StudioOperand`, which is the point.
 */
const COMPILE = `
import { compileExpressionToJs } from "@modyra/studio-codegen";
import { createBlankProject, loadProject } from "@modyra/studio-model";

const OPERANDS = [
  ["a string", "hello"],
  ["a string that reads like code", "1; globalThis.taken = 1"],
  ["a number", 42],
  ["a boolean", true],
  ["null", null],
  ["an array carrying an assignment", ["globalThis.taken = 1"]],
  ["an array carrying a call", ["fetch('//elsewhere')"]],
  ["an object", { a: 1 }],
];

const blank = createBlankProject();
const out = OPERANDS.map(([label, operand]) => {
  const draft = JSON.parse(JSON.stringify(blank));
  draft.formValidators = [{
    id: "v1", kind: "crossField", dependencies: [], message: "nope",
    condition: { op: "equals", operands: [{ nodeId: draft.schema.id }, operand] },
  }];
  const { project, diagnostics } = loadProject(draft);
  const condition = project.formValidators?.[0]?.condition ?? null;
  let compiled = null;
  let raised = null;
  if (condition) {
    try { compiled = compileExpressionToJs(condition, () => "a"); }
    catch (error) { raised = String(error.message).slice(0, 60); }
  }
  return { label, diagnostics: diagnostics.map((each) => each.code), compiled, raised };
});
console.log(JSON.stringify(out));
`;

battle(
  {
    claims: ["STU-001", "SEC-001"],
    title: "a value in a project file does not become code in the generated module",
    environments: ["node"],
  },
  async (ctx) => {
    const result = runInConsumer(COMPILE);

    try {
      expectClaim(result.ran === true, {
        claimIds: ["STU-001"],
        what: "studio-codegen and studio-model could not be packed and installed",
        detail: result.message ?? "",
      });

      const compiled = result.out;
      ctx.log.note("what each operand compiled to", {
        rows: compiled.map((each) => [each.label, each.compiled ?? each.raised]),
      });

      // The control, and the half that is right: a string operand is printed as a string literal,
      // so text that reads like code stays text. Whatever a fix does, it must not disturb this.
      const asText = compiled.find((each) => each.label === "a string that reads like code");
      expectEqual(asText.compiled, 'value["a"] === "1; globalThis.taken = 1"', {
        claimIds: ["STU-001"],
        what: "a string operand stopped being printed as a string literal",
        detail: JSON.stringify(asText),
      });

      // And the primitives the type does allow, which must keep compiling to themselves.
      for (const [label, expected] of [["a number", "42"], ["a boolean", "true"], ["null", "null"]]) {
        const each = compiled.find((row) => row.label === label);
        expectEqual(each.compiled, `value["a"] === ${expected}`, {
          claimIds: ["STU-001"],
          what: `${label} no longer compiles to itself`,
          detail: JSON.stringify(each),
        });
      }

      // An operand outside `StudioOperand` — the type admits a node reference, a string, a number,
      // a boolean, null or a nested expression, and nothing else. `String(operand)` puts whatever it
      // is into the emitted expression unquoted, so an array becomes its own join and a project file
      // decides what the generated module executes.
      const outside = compiled.filter((each) => each.label.startsWith("an array") || each.label === "an object");
      const emitted = outside.map((each) => ({
        operand: each.label,
        compiled: each.compiled,
        reported: each.diagnostics,
      }));

      // Either the loader refuses it, or the compiler does. What must not happen is that it reaches
      // the output as text.
      //
      // The right-hand side is what the operand became, so that is what is inspected — asking
      // whether the whole expression "contains a quote" would be answered by `value["a"]` and pass
      // for every operand there is.
      const literalSide = (line) => (line ?? "").split(" === ")[1] ?? "";
      const isALiteral = (text) => /^(?:"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?|true|false|null)$/.test(text);

      const leaked = emitted
        .filter((each) => each.compiled !== null && !isALiteral(literalSide(each.compiled)))
        .map((each) => ({ ...each, became: literalSide(each.compiled) }));

      // The control on the detector itself: the operands that are in the type do read as literals,
      // so `isALiteral` is answering rather than refusing everything.
      const inType = compiled
        .filter((each) => ["a string", "a number", "a boolean", "null"].includes(each.label))
        .filter((each) => !isALiteral(literalSide(each.compiled)));

      expectEqual(inType, [], {
        claimIds: ["STU-001"],
        what: "the check that decides whether an operand became a literal refuses ones that plainly are",
        detail: JSON.stringify(inType.map((each) => [each.label, literalSide(each.compiled)])),
      });

      expectEqual(leaked, [], {
        claimIds: ["STU-001", "SEC-001"],
        what: "an operand outside the expression type was written into the generated module as raw text",
        detail: JSON.stringify(emitted),
      });
    } finally {
      if (result.work) rmSync(result.work, { recursive: true, force: true });
    }
  },
);

/** Generate a form module for one field carrying one validator, per value under test. */
const VALIDATORS = `
import { buildFormModule } from "@modyra/studio-codegen";
import { createBlankProject, loadProject } from "@modyra/studio-model";

// A profile, not a target. \`buildFormModule\` takes the third of these and a target is not one —
// handed a target it used to emit \`from "undefined"\` and say nothing, which this battle asserted
// nothing about because it only ever looked at the bound.
const PROFILE = { factoryImportSource: "@modyra/core", createCallName: "createForm" };

const VALUES = [
  ["a whole number", 3],
  ["a string", "3"],
  ["not a number", NaN],
  ["without bound", Infinity],
  ["negative infinity", -Infinity],
];

const blank = createBlankProject();
const out = VALUES.map(([label, value]) => {
  const draft = JSON.parse(JSON.stringify(blank));
  draft.schema = {
    node: "group", id: "root", name: "root",
    children: [{ node: "field", id: "f1", name: "amount", kind: "text",
      validators: [{ id: "v1", kind: "minLength", value }] }],
  };
  const { project } = loadProject(draft);
  const built = buildFormModule(project, new Map(), PROFILE);
  // Matched with a multiline regex rather than split on a newline: this source is carried through a
  // template literal, where a lone escape collapses into the character it names.
  // Matched with a multiline regex rather than split on a newline: this source is carried through a
  // template literal, where a lone escape collapses into the character it names.
  const line = ((built.code ?? "").match(/^.*amount.*$/m) ?? [null])[0]?.trim() ?? null;
  const sources = [...(built.code ?? "").matchAll(/from "([^"]+)"/g)].map((each) => each[1]);
  return { label, line, sources, diagnostics: (built.diagnostics ?? []).map((each) => each.code) };
});
console.log(JSON.stringify(out));
`;

battle(
  {
    claims: ["STU-002"],
    title: "a bound the author wrote is emitted, or reported as omitted",
    environments: ["node"],
  },
  async (ctx) => {
    const result = runInConsumer(VALIDATORS);

    try {
      expectClaim(result.ran === true, {
        claimIds: ["STU-002"],
        what: "the studio packages could not be packed and installed",
        detail: result.message ?? "",
      });

      const rows = result.out;
      ctx.log.note("what each bound became", { rows: rows.map((each) => [each.label, each.line, each.diagnostics]) });

      const byLabel = (label) => rows.find((each) => each.label === label);

      // Before anything about bounds: the module this battle reads has to be one a consumer could
      // compile. A profile missing its import source emits `from "undefined"`, and every assertion
      // below would still pass while inspecting a module that cannot be used — which is what this
      // battle did until the generator started refusing that profile.
      const unresolvable = rows
        .flatMap((each) => (each.sources ?? []).map((source) => ({ label: each.label, source })))
        .filter((each) => !each.source.startsWith("@modyra/"));

      expectEqual(unresolvable, [], {
        claimIds: ["STU-002"],
        what: "the generated module imports from somewhere no consumer could resolve, so nothing below is about a usable module",
        detail: JSON.stringify(rows.map((each) => [each.label, each.sources])),
      });

      // The control: a usable bound is emitted as itself and nothing is reported. Everything below
      // is measured against this.
      expectClaim(byLabel("a whole number").line?.includes("minLength(3)") === true, {
        claimIds: ["STU-002"],
        what: "a whole-number bound is no longer emitted as itself",
        detail: JSON.stringify(byLabel("a whole number")),
      });

      // The second control, and the reason this is a gap rather than a missing feature: a value of
      // the wrong *type* is already caught and reported, and the rule is left out rather than
      // emitted hollow. The machinery exists.
      const wrongType = byLabel("a string");
      expectClaim(wrongType.diagnostics.includes("MISSING_VALIDATOR_VALUE") && !wrongType.line?.includes("minLength"), {
        claimIds: ["STU-002"],
        what: "a bound of the wrong type is no longer reported and omitted, which is the behaviour the rest of this battle is measured against",
        detail: JSON.stringify(wrongType),
      });

      // And the values that have a number's type and are not bounds. `typeof value === "number"`
      // admits them; `JSON.stringify` turns each into `null`; the emitted rule is `minLength(null)`,
      // which accepts every string there is. The author wrote a minimum and the form has none, with
      // nothing anywhere saying so.
      const unusable = ["not a number", "without bound", "negative infinity"].map(byLabel);
      const silentlyEmpty = unusable
        .filter((each) => each.line?.includes("minLength(null)") === true)
        .map((each) => ({ value: each.label, emitted: each.line, reported: each.diagnostics }));

      expectEqual(silentlyEmpty, [], {
        claimIds: ["STU-002"],
        what: "a bound that is not a number was emitted as an empty rule instead of being reported",
        detail: JSON.stringify(unusable),
      });

      // Whichever way it is fixed — reported and omitted, like the wrong type, or refused earlier —
      // what must not survive is a rule in the output that constrains nothing.
      for (const each of unusable) {
        expectClaim(
          each.diagnostics.length > 0 || each.line?.includes("minLength") !== true,
          {
            claimIds: ["STU-002"],
            what: `${each.label} produced a rule in the generated form and no diagnostic`,
            detail: JSON.stringify(each),
          },
        );
      }
    } finally {
      if (result.work) rmSync(result.work, { recursive: true, force: true });
    }
  },
);

/** Compile the same array bound to a contract, which is the project's other output. */
const CONTRACT = `
import { compileToContract } from "@modyra/studio-contract";
import { createBlankProject, loadProject } from "@modyra/studio-model";

const VALUES = [
  ["no rule at all", undefined],
  ["a whole number", 3],
  ["not a number", NaN],
  ["without bound", Infinity],
  ["a string", "3"],
];

const blank = createBlankProject();
const out = VALUES.map(([label, value]) => {
  const draft = JSON.parse(JSON.stringify(blank));
  draft.schema = {
    node: "group", id: "root", name: "root",
    children: [{
      node: "array", id: "a1", name: "rows", initialRows: [],
      item: { node: "group", id: "g1", name: "row",
        children: [{ node: "field", id: "f1", name: "sku", kind: "text", validators: [] }] },
      validators: value === undefined ? [] : [{ id: "v1", kind: "min", value }],
    }],
  };
  const { project } = loadProject(draft);
  const compiled = compileToContract(project);
  const document = compiled.document ?? compiled.contract ?? compiled;
  const found = JSON.stringify(document).match(/"minItems":([^,}]*)/);
  return { label, minItems: found ? found[1] : null, diagnostics: (compiled.diagnostics ?? []).map((each) => each.code) };
});
console.log(JSON.stringify(out));
`;

battle(
  {
    claims: ["STU-002"],
    title: "a row count the author wrote reaches the contract, or is reported as lost",
    environments: ["node"],
  },
  async (ctx) => {
    // A project has two outputs. The battle above is the generated module; this is the Dynamic Form
    // Contract, compiled by a different package from the same validators — so a bound repaired in
    // one is not repaired in the other, and the same question has to be asked twice.
    const result = runInConsumer(CONTRACT);

    try {
      expectClaim(result.ran === true, {
        claimIds: ["STU-002"],
        what: "the studio packages could not be packed and installed",
        detail: result.message ?? "",
      });

      const rows = result.out;
      const byLabel = (label) => rows.find((each) => each.label === label);
      ctx.log.note("what each row count became in the contract", {
        rows: rows.map((each) => [each.label, each.minItems, each.diagnostics]),
      });

      // The controls: a usable bound reaches the contract, and no rule leaves it out entirely, so
      // the assertions below are about a bound that is neither.
      expectEqual(byLabel("a whole number").minItems, "3", {
        claimIds: ["STU-002"],
        what: "a whole-number row count no longer reaches the contract",
        detail: JSON.stringify(byLabel("a whole number")),
      });

      expectEqual(byLabel("no rule at all").minItems, null, {
        claimIds: ["STU-002"],
        what: "a collection with no row-count rule carries one in the contract anyway",
        detail: JSON.stringify(byLabel("no rule at all")),
      });

      // And the wrong *type*, which is already dropped — the same control that makes this a gap
      // rather than a missing feature in the module battle above.
      expectEqual(byLabel("a string").minItems, null, {
        claimIds: ["STU-002"],
        what: "a row count of the wrong type reached the contract",
        detail: JSON.stringify(byLabel("a string")),
      });

      // The values with a number's type that are not counts. `typeof` admits them and the contract
      // is written as JSON, where both become `null` — a rule the author wrote, present in the
      // output as nothing, with no diagnostic between the two.
      const unusable = ["not a number", "without bound"].map(byLabel);
      const emptied = unusable
        .filter((each) => each.minItems === "null" && each.diagnostics.length === 0)
        .map((each) => ({ bound: each.label, minItems: each.minItems }));

      expectEqual(emptied, [], {
        claimIds: ["STU-002"],
        what: "a row count that is not a finite number reached the contract as null, with nothing reported",
        detail: JSON.stringify(unusable),
      });
    } finally {
      if (result.work) rmSync(result.work, { recursive: true, force: true });
    }
  },
);

/** Compile one field per declared kind, and report what reached the contract. */
const FIELD_KINDS = `
import { compileToContract } from "@modyra/studio-contract";
import { createBlankProject, loadProject } from "@modyra/studio-model";

const KINDS = [
  ["a kind this build knows", "text"],
  ["a kind nobody declared", "wormhole"],
  ["no kind at all", undefined],
];

const blank = createBlankProject();
const out = KINDS.map(([label, fieldKind]) => {
  const draft = JSON.parse(JSON.stringify(blank));
  draft.schema = {
    node: "group", id: "root", name: "root",
    children: [{
      node: "field", id: "f1", name: "email", initialValue: "", valueType: "string", validators: [],
      ...(fieldKind === undefined ? {} : { fieldKind }),
    }],
  };
  const loaded = loadProject(draft);
  const compiled = compileToContract(loaded.project);
  const document = compiled.contract ?? compiled.document ?? compiled;
  const field = document?.schema?.children?.email?.field ?? null;
  return {
    label,
    kindInContract: field === null ? null : (field.kind ?? null),
    loadDiagnostics: loaded.diagnostics.map((each) => each.code),
    compileDiagnostics: (compiled.diagnostics ?? []).map((each) => each.code),
  };
});
console.log(JSON.stringify(out));
`;

battle(
  {
    claims: ["STU-003"],
    title: "a field kind nobody recognises is reported, not quietly removed",
    environments: ["node"],
  },
  async (ctx) => {
    // A field's kind is what makes it a field: the contract's consumer builds a control from it, and
    // an entry with none is dropped when the schema is built. The question is whether anything says
    // so between the project and there.
    const result = runInConsumer(FIELD_KINDS);

    try {
      expectClaim(result.ran === true, {
        claimIds: ["STU-003"],
        what: "the studio packages could not be packed and installed",
        detail: result.message ?? "",
      });

      const rows = result.out;
      const byLabel = (label) => rows.find((each) => each.label === label);
      ctx.log.note("what each field kind became in the contract", {
        rows: rows.map((each) => [each.label, each.kindInContract, each.loadDiagnostics, each.compileDiagnostics]),
      });

      // The control: a kind this build knows reaches the contract, so the assertions below are
      // about the unknown ones rather than about kinds never travelling.
      expectEqual(byLabel("a kind this build knows").kindInContract, "text", {
        claimIds: ["STU-003"],
        what: "a declared field kind no longer reaches the contract",
        detail: JSON.stringify(byLabel("a kind this build knows")),
      });

      // A kind this build does not know is the ordinary case, not a hostile one: a project written
      // by a newer Studio, a file edited by hand, a kind added to the catalogue after the generator
      // shipped. Whatever the answer is, silence is not one — the field arrives in the contract as
      // an entry with no kind, and is dropped where the schema is built, far from anyone who could
      // fix it.
      for (const label of ["a kind nobody declared", "no kind at all"]) {
        const row = byLabel(label);
        const reported = row.loadDiagnostics.length + row.compileDiagnostics.length;

        expectClaim(row.kindInContract !== null || reported > 0, {
          claimIds: ["STU-003"],
          what: `${label} produced a field with no kind in the contract, and neither the loader nor the compiler said anything`,
          detail: JSON.stringify(row),
        });
      }
    } finally {
      if (result.work) rmSync(result.work, { recursive: true, force: true });
    }
  },
);

/**
 * Drive the published conformance suite with targets the battle owns.
 *
 * Written as source for the consumer because studio is reached through a packed install; the
 * separator is built from its character code so it never has to survive this file, a template
 * literal and a heredoc intact.
 */
const CONFORMANCE = `
import { runConformanceSuite } from "@modyra/studio-codegen";
import { createBlankProject, loadProject } from "@modyra/studio-model";

const BACKSLASH = String.fromCharCode(92);
const GOOD_FILE = { path: "form.ts", language: "ts", role: "source", content: "export {};" };
const fileAt = (path) => ({ ...GOOD_FILE, path });

const targetEmitting = (files) => ({
  id: "battle", displayName: "Battle target", version: "1.0.0", capabilities: {},
  defaults: () => ({}),
  analyze: async () => ({ compatible: true, diagnostics: [] }),
  generate: async () => ({ targetId: "battle", files, diagnostics: [] }),
});

const { project } = loadProject(createBlankProject());
const judge = async (label, files) => {
  const result = await runConformanceSuite(targetEmitting(files), project);
  return { label, passed: result.passed, failures: result.failures };
};

const out = {
  ordinary: await judge("an ordinary file", [GOOD_FILE]),
  posix: [
    await judge("a parent directory", [fileAt("../out.ts")]),
    await judge("two levels up", [fileAt("a/../../out.ts")]),
    await judge("an absolute path", [fileAt("/etc/passwd")]),
  ],
  windows: [
    await judge("a parent directory", [fileAt(".." + BACKSLASH + "out.ts")]),
    await judge("two levels up", [fileAt("a" + BACKSLASH + ".." + BACKSLASH + ".." + BACKSLASH + "out.ts")]),
    await judge("a drive-absolute path", [fileAt("C:" + BACKSLASH + "out.ts")]),
    await judge("a network share", [fileAt(BACKSLASH + BACKSLASH + "server" + BACKSLASH + "share")]),
    await judge("mixed separators", [fileAt("a/.." + BACKSLASH + ".." + BACKSLASH + "out.ts")]),
  ],
  shape: [
    await judge("a file with no content", [{ path: "form.ts", language: "ts", role: "source" }]),
    await judge("a file whose content is a number", [{ ...GOOD_FILE, content: 42 }]),
    await judge("two files at one path", [{ ...GOOD_FILE, content: "1" }, { ...GOOD_FILE, content: "2" }]),
    await judge("no files at all", []),
  ],
  missingRole: await judge("a file with no role", [{ path: "form.ts", language: "ts", content: "export {};" }]),
};
console.log(JSON.stringify(out));
`;

battle(
  {
    claims: ["STU-004"],
    title: "a path that leaves the output directory is refused however it is spelled",
    environments: ["node"],
  },
  async (ctx) => {
    // `runConformanceSuite` states its own standing: every target must pass it before it ships. It
    // is what stands between a third-party target — `TargetRegistry` is exported — and a host that
    // writes whatever it is handed to disk.
    //
    // Its path check is `startsWith("/") || split("/").includes("..")`, which is one of the two ways
    // a path is spelled.
    const result = runInConsumer(CONFORMANCE);

    try {
      expectClaim(result.ran === true, {
        claimIds: ["STU-004"],
        what: "the studio packages could not be packed and installed",
        detail: result.message ?? "",
      });

      const { ordinary, posix, windows } = result.out;
      ctx.log.note("what the suite made of each path", { ordinary, posix, windows });

      // The known-good case, in the same run: an ordinary file passes, so a refusal below is the
      // path rather than a suite that refuses everything.
      expectClaim(ordinary.passed === true, {
        claimIds: ["STU-004"],
        what: "a well-formed target did not pass, so nothing below distinguishes a bad path from a bad suite",
        detail: JSON.stringify(ordinary.failures),
      });

      // The spellings the check was written against, so the comparison is between two notations of
      // one escape rather than between a check and nothing.
      const missedPosix = posix.filter((each) => each.passed).map((each) => each.label);
      expectEqual(missedPosix, [], {
        claimIds: ["STU-004"],
        what: "a POSIX escape was admitted, so the path check is not the thing this battle is about",
        detail: JSON.stringify(posix),
      });

      // And the same escapes spelled for the other platform. A host on Windows resolves each of
      // these exactly as it reads.
      const admitted = windows.filter((each) => each.passed).map((each) => each.label);
      expectEqual(admitted, [], {
        claimIds: ["STU-004"],
        what: "a path that leaves the output directory was admitted because of how it is spelled",
        detail: JSON.stringify(windows),
      });
    } finally {
      if (result.work) rmSync(result.work, { recursive: true, force: true });
    }
  },
);

battle(
  {
    claims: ["STU-004"],
    title: "a target that generates nothing usable does not pass",
    environments: ["node"],
  },
  async (ctx) => {
    // A generated file is a path, a language, a role and content. Three of those are checked.
    const result = runInConsumer(CONFORMANCE);

    try {
      expectClaim(result.ran === true, {
        claimIds: ["STU-004"],
        what: "the studio packages could not be packed and installed",
        detail: result.message ?? "",
      });

      const { shape, missingRole } = result.out;
      ctx.log.note("what the suite made of each target", { shape, missingRole });

      // The known-good case for this half: the suite does refuse a file missing one of the three
      // fields it checks, so it is answering about the target rather than passing everything.
      expectClaim(missingRole.passed === false, {
        claimIds: ["STU-004"],
        what: "a file missing its role was admitted, so the suite is not checking file shape at all",
        detail: JSON.stringify(missingRole.failures),
      });

      const admitted = shape.filter((each) => each.passed).map((each) => each.label);
      expectEqual(admitted, [], {
        claimIds: ["STU-004"],
        what: "a target that generates nothing a host could write was declared conformant",
        detail: JSON.stringify(shape),
      });
    } finally {
      if (result.work) rmSync(result.work, { recursive: true, force: true });
    }
  },
);

/** Build one import block per case and report it, so the module can be checked out here. */
const IMPORTS = `
import { ImportResolver } from "@modyra/studio-codegen";

const CASES = [
  ["one source", (r) => r.add("@modyra/core", "field", "group")],
  ["the same source twice", (r) => { r.add("@modyra/core", "field"); r.add("@modyra/core", "group"); }],
  ["two sources, different names", (r) => { r.add("@modyra/core", "field"); r.add("@modyra/widgets", "required"); }],
  ["two sources, the same name", (r) => { r.add("@modyra/core", "field"); r.add("@modyra/widgets", "field"); }],
  ["a name that is not an identifier", (r) => r.add("@modyra/core", "with space")],
  ["a name that is a reserved word", (r) => r.add("@modyra/core", "class")],
  ["a source carrying a quote", (r) => r.add(String.fromCharCode(97, 34, 98), "field")],
];

const out = CASES.map(([label, build]) => {
  const resolver = new ImportResolver();
  build(resolver);
  return { label, block: resolver.print() };
});
console.log(JSON.stringify(out));
`;

battle(
  {
    claims: ["STU-001"],
    title: "an import block is one a module can be built from",
    environments: ["node"],
  },
  async (ctx) => {
    // `ImportResolver` is published, and a target assembling its own module uses it directly. What
    // it prints is the first thing in the file, so anything wrong here costs the whole module rather
    // than one declaration.
    //
    // Three of the cases below have their answer in this same package: a reserved word is what
    // `isValidBindingName` decides, a name that is not identifier-shaped is what `toBindingName`
    // repairs, and a source carrying a quote is what `printString` is for. None is consulted.
    const result = runInConsumer(IMPORTS);
    const scratch = mkdtempSync(join(tmpdir(), "mdy-imports-"));

    try {
      expectClaim(result.ran === true, {
        claimIds: ["STU-001"],
        what: "studio-codegen could not be packed and installed",
        detail: result.message ?? "",
      });

      /** Whether an import block can begin a module — asked of the parser, not of a rule. */
      const compiles = (block) => {
        const file = join(scratch, `m${Math.random().toString(36).slice(2)}.mjs`);
        writeFileSync(file, `${block}
export {};
`, "utf8");
        try {
          execFileSync(process.execPath, ["--check", file], { stdio: "ignore" });
          return true;
        } catch {
          return false;
        }
      };

      const checked = result.out.map((each) => ({ ...each, compiles: compiles(each.block) }));
      ctx.log.note("what each import block amounts to", {
        blocks: checked.map((each) => [each.label, each.compiles, each.block.replace(/\n/g, " ")]),
      });

      // The known-good cases, in the same run: an ordinary block compiles, the same source twice is
      // merged rather than repeated, and two sources with different names are two lines. So a
      // failure below is the case under test rather than a check that refuses every import block.
      for (const label of ["one source", "the same source twice", "two sources, different names"]) {
        const each = checked.find((row) => row.label === label);
        expectClaim(each.compiles === true, {
          claimIds: ["STU-001"],
          what: `${label} does not produce a usable import block, so nothing below is about the hostile cases`,
          detail: JSON.stringify(each),
        });
      }

      // And merging is what makes the same source twice safe, which is worth stating separately:
      // two lines importing from one module is legal but is not what this resolver promises.
      const merged = checked.find((each) => each.label === "the same source twice");
      expectEqual((merged.block.match(/^import /gm) ?? []).length, 1, {
        claimIds: ["STU-001"],
        what: "the same source twice produced two import lines instead of one",
        detail: JSON.stringify(merged),
      });

      const broken = checked
        .filter((each) => !each.compiles)
        .map((each) => ({ case: each.label, block: each.block.replace(/\n/g, " | ") }));

      expectEqual(broken, [], {
        claimIds: ["STU-001"],
        what: "an import block was printed that no module can be built from",
        detail: JSON.stringify(broken),
      });
    } finally {
      rmSync(scratch, { recursive: true, force: true });
      if (result.work) rmSync(result.work, { recursive: true, force: true });
    }
  },
);

/** Load layouts of increasing depth, and one that contains itself, reporting how each went. */
const LAYOUTS = `
import { arrangementDiagnostics } from "@modyra/studio-codegen";
import { STUDIO_LAYOUT_MAX_DEPTH, createBlankProject, loadProject } from "@modyra/studio-model";

const nest = (levels) => {
  let node = { kind: "section", id: "leaf", children: [] };
  for (let level = 0; level < levels; level += 1) node = { kind: "section", id: "s" + level, children: [node] };
  return [node];
};

const withLayout = (layout) => ({ ...createBlankProject(), presentation: { layout } });
const TARGET = { id: "battle", capabilities: { supportsLayout: false } };

const attempt = (label, layout) => {
  let loaded = null;
  let loadRaised = null;
  try { loaded = loadProject(withLayout(layout)); }
  catch (error) { loadRaised = error.constructor.name; }

  let arrangementRaised = null;
  if (loaded) {
    try { arrangementDiagnostics(loaded.project, TARGET); }
    catch (error) { arrangementRaised = error.constructor.name; }
  }

  return {
    label,
    loadRaised,
    loadDiagnostics: loaded ? loaded.diagnostics.map((each) => each.code) : [],
    arrangementRaised,
  };
};

const cyclic = { kind: "section", id: "a", children: [] };
cyclic.children.push(cyclic);

const out = {
  declaredMax: STUDIO_LAYOUT_MAX_DEPTH,
  ordinary: attempt("within the declared depth", nest(3)),
  past: attempt("past the declared depth", nest(STUDIO_LAYOUT_MAX_DEPTH + 2)),
  far: attempt("far past the declared depth", nest(4000)),
  cyclic: attempt("a section that contains itself", [cyclic]),
};
console.log(JSON.stringify(out));
`;

battle(
  {
    claims: ["STU-005"],
    title: "a layout too deep to use is reported, however much too deep it is",
    environments: ["node"],
  },
  async (ctx) => {
    // `loadProject` returns `{ project, diagnostics }` — reporting is how it answers, and
    // `LAYOUT_TOO_DEEP` is what it says about a layout past `STUDIO_LAYOUT_MAX_DEPTH`. The guard
    // exists and works. What it does not survive is more of the thing it guards against: its own
    // walk is recursive and unbounded, so a layout deep enough raises instead of reporting.
    //
    // A project file some thousands of sections deep is not exotic — it is what a generator, an
    // import, or a loop in an editor produces — and the difference between a diagnostic and a
    // RangeError is the difference between a message and a host that stopped.
    const result = runInConsumer(LAYOUTS);

    try {
      expectClaim(result.ran === true, {
        claimIds: ["STU-005"],
        what: "the studio packages could not be packed and installed",
        detail: result.message ?? "",
      });

      const { declaredMax, ordinary, past, far } = result.out;
      ctx.log.note("what the model made of each depth", { declaredMax, ordinary, past, far });

      // The known-good case, in the same run: an ordinary layout loads silently and is walked.
      expectClaim(ordinary.loadRaised === null && ordinary.loadDiagnostics.length === 0, {
        claimIds: ["STU-005"],
        what: "a layout within the declared depth did not load cleanly, so nothing below is about depth",
        detail: JSON.stringify(ordinary),
      });

      // And the guard doing its job just past the bound, which is what makes the case below a gap
      // in it rather than its absence.
      expectClaim(past.loadRaised === null && past.loadDiagnostics.includes("LAYOUT_TOO_DEEP"), {
        claimIds: ["STU-005"],
        what: "a layout past the declared depth was not reported, so there is no guard for the deeper case to defeat",
        detail: JSON.stringify(past),
      });

      expectEqual(far.loadRaised, null, {
        claimIds: ["STU-005"],
        what: "a layout far past the declared depth raised instead of being reported, so the depth guard is defeated by depth",
        detail: JSON.stringify(far),
      });
    } finally {
      if (result.work) rmSync(result.work, { recursive: true, force: true });
    }
  },
);

battle(
  {
    claims: ["STU-005"],
    title: "a layout that contains itself is reported by the stage that can see it",
    environments: ["node"],
  },
  async (ctx) => {
    // A section dropped into itself is what an editor with drag-and-drop produces, and the model
    // clones a project structurally on the way in — which preserves the cycle rather than breaking
    // it. `loadProject` reports `LAYOUT_TOO_DEEP`, which is the symptom of a cycle rather than the
    // cycle, and then hands the project on.
    //
    // The stage that raises is `arrangementDiagnostics`, one package along, whose whole job is to
    // count what it was given. A cycle has no count.
    const result = runInConsumer(LAYOUTS);

    try {
      expectClaim(result.ran === true, {
        claimIds: ["STU-005"],
        what: "the studio packages could not be packed and installed",
        detail: result.message ?? "",
      });

      const { ordinary, cyclic } = result.out;
      ctx.log.note("what a self-containing section did to each stage", { cyclic });

      // The known-good case again: an ordinary layout is walked without raising, so the raise below
      // is the cycle rather than the walker.
      expectEqual(ordinary.arrangementRaised, null, {
        claimIds: ["STU-005"],
        what: "an ordinary layout raised while being counted, so nothing below is about the cycle",
        detail: JSON.stringify(ordinary),
      });

      expectEqual(cyclic.arrangementRaised, null, {
        claimIds: ["STU-005"],
        what: "a layout that contains itself raised in a later package, after the loader accepted it",
        detail: JSON.stringify(cyclic),
      });
    } finally {
      if (result.work) rmSync(result.work, { recursive: true, force: true });
    }
  },
);

/** Load schemas of increasing depth, and report what the model made of each. */
const SCHEMAS = `
import { MAX_DEPTH } from "@modyra/studio-editor";
import { createBlankProject, loadProject } from "@modyra/studio-model";

const nest = (levels) => {
  let node = { node: "field", id: "leaf", name: "leaf", fieldKind: "text", valueType: "string", initialValue: "", validators: [] };
  for (let level = 0; level < levels; level += 1) {
    node = { node: "group", id: "g" + level, name: "g" + level, children: [node] };
  }
  return node;
};

const attempt = (label, levels) => {
  const draft = { ...createBlankProject(), schema: { node: "group", id: "root", name: "root", children: [nest(levels)] } };
  try {
    const { diagnostics } = loadProject(draft);
    return { label, levels, raised: null, diagnostics: diagnostics.map((each) => each.code) };
  } catch (error) {
    return { label, levels, raised: error.constructor.name, diagnostics: [] };
  }
};

console.log(JSON.stringify({
  placementBound: MAX_DEPTH,
  ordinary: attempt("an ordinary schema", 5),
  // A leaf wrapped in N groups sits inside a root group too, so it has N + 1 ancestors. The
  // editor's bound counts ancestors, which makes one fewer wrapping group the deepest it will
  // place — verified against the loader, which changes its answer at exactly that point.
  atTheEditorsBound: attempt("as deep as the editor will place", MAX_DEPTH - 1),
  pastIt: attempt("deeper than the editor will place", MAX_DEPTH + 8),
  far: attempt("far deeper than anything", 4000),
}));
`;

battle(
  {
    claims: ["STU-005"],
    title: "a schema too deep to use is reported, however much too deep it is",
    environments: ["node"],
  },
  async (ctx) => {
    // STU-005 was registered against the layout because that is where the first evidence was; the
    // promise it names is the model's, and a project carries two nested structures through the same
    // clone. This is the other one.
    //
    // The editor refuses to *place* a node past `MAX_DEPTH` ancestors, so nothing built in a session
    // goes deeper. A project arrives from a file, and the loader asks nothing.
    //
    // The two bounds count different things and agree on the number: this fixture nests inside a
    // root group, so `MAX_DEPTH - 1` wrapping groups is the deepest the editor will place. Reading
    // the constant and reasoning about it gave the wrong fixture; the loader's own answer gave the
    // right one.
    const result = runInConsumer(SCHEMAS);

    try {
      expectClaim(result.ran === true, {
        claimIds: ["STU-005"],
        what: "the studio packages could not be packed and installed",
        detail: result.message ?? "",
      });

      const { placementBound, ordinary, atTheEditorsBound, pastIt, far } = result.out;
      ctx.log.note("what the model made of each schema depth", {
        placementBound, ordinary, atTheEditorsBound, pastIt, far,
      });

      // The known-good cases, in the same run: an ordinary schema loads silently, and so does one at
      // the depth the editor itself will build to.
      for (const each of [ordinary, atTheEditorsBound]) {
        expectClaim(each.raised === null && each.diagnostics.length === 0, {
          claimIds: ["STU-005"],
          what: `${each.label} did not load cleanly, so nothing below is about depth`,
          detail: JSON.stringify(each),
        });
      }

      // A schema deeper than the editor will place is one no editor session produced — a file, an
      // import, a generator. The editor has an opinion about this depth and the loader has none.
      expectClaim(pastIt.raised === null && pastIt.diagnostics.length > 0, {
        claimIds: ["STU-005"],
        what: `a schema deeper than the editor's own bound of ${placementBound} loaded with nothing said about it`,
        detail: JSON.stringify(pastIt),
      });

      // And the depth that defeats the clone the project passes through on the way in.
      //
      // Refusing is right here and reporting was not: an arrangement can be dropped because a
      // project without one is still a project, and a project without a schema is not. What the
      // refusal must not be is the clone giving way — a RangeError is the runtime running out of
      // stack, which names nothing, arrives from a frame nobody wrote, and looks the same as a
      // defect in the host.
      expectEqual(far.raised, "StudioModelError", {
        claimIds: ["STU-005"],
        what: "a schema too deep to process was refused by something other than the model, so the guard is not ahead of the clone",
        detail: JSON.stringify(far),
      });
    } finally {
      if (result.work) rmSync(result.work, { recursive: true, force: true });
    }
  },
);
