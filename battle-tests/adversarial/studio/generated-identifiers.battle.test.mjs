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
    for (const pkg of ["studio-model", "studio-codegen"]) {
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
