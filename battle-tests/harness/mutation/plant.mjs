/**
 * Plants one defect in a package's build and reports which checks go red.
 *
 * The question a coverage count cannot answer: *is there a check that fails when this behaviour
 * changes*. A name mentioned by a test has been mentioned; a name whose defect turns a check red has
 * been defended, and only the second is worth the word.
 *
 * Nothing is written to the tree. The package's build is copied, the defect is planted in the copy,
 * and a resolve hook makes the corpus read the copy — so a peer building in the same working tree
 * cannot pick up a poisoned artefact.
 *
 * Three answers are possible and they are not the same:
 *
 *   the plant did not change the file       nothing was measured
 *   no file was redirected                  the real tree was measured
 *   redirected, and nothing went red        the defect is undefended, *or* it changes no behaviour
 *
 * The third is the one that lies. A sentinel whose value is never written down anywhere — every
 * producer and consumer reads the constant — has no value-level defect to plant: changing it is a
 * rename. Such a name is mutated through its meaning instead, at the place that treats it specially.
 *
 *   node battle-tests/harness/mutation/plant.mjs <package> <file-in-dist> <sed-expression>
 *   node battle-tests/harness/mutation/plant.mjs widgets structure.js 's/VERSION = 5/VERSION = 6/'
 *
 * With no arguments the run is a control: the copy is used unchanged, and anything that goes red is
 * the instrument rather than the defect. Run it before believing any number this produces.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, globSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO = new URL("../../..", import.meta.url).pathname.replace(/\/$/, "");
/** The node-side corpus: every test that can see a package's behaviour without a browser. */
const CORPUS = [
  "packages/core/test/*.test.mjs", "packages/widgets/test/*.spec.mjs", "packages/plain/test/*.test.mjs",
  "battle-tests/adversarial/**/*.test.mjs", "battle-tests/harness/*.test.mjs",
];

const [pkg = "widgets", file, expression] = process.argv.slice(2);

const files = CORPUS.flatMap((pattern) => globSync(pattern, { cwd: REPO })).sort();

const failures = (env) => {
  const run = spawnSync("node", ["--test", "--test-reporter=tap", ...files], {
    cwd: REPO, env: { ...process.env, ...env }, encoding: "utf8", maxBuffer: 256 * 1024 * 1024,
  });
  return new Set((`${run.stdout}`.match(/^not ok \d+ - .*$/gm) ?? []).map((line) => line.replace(/^not ok \d+ - /, "")));
};

// Resolved, because a temporary directory is reached through a link on macOS and the hook compares
// file URLs by prefix: an unresolved path matches nothing and the run silently reads the real tree.
const workspace = realpathSync(mkdtempSync(join(tmpdir(), "mdy-mutation-")));
const copy = join(workspace, "dist");
cpSync(join(REPO, "packages", pkg, "dist"), copy, { recursive: true });

if (file !== undefined && expression !== undefined) {
  const target = join(copy, file);
  const before = readFileSync(target, "utf8");
  execFileSync("sed", ["-i", "", expression, target]);
  if (readFileSync(target, "utf8") === before) {
    console.error(`The plant changed nothing in ${file}. Nothing was measured.`);
    rmSync(workspace, { recursive: true, force: true });
    process.exit(2);
  }
}

const log = join(workspace, "redirections");
writeFileSync(log, "");
const baseline = failures({});
const planted = failures({
  NODE_OPTIONS: `--import ${new URL("./register.mjs", import.meta.url).pathname}`,
  MDY_REAL_DIR: join(REPO, "packages", pkg, "dist"), MDY_MUTANT_DIR: copy, MDY_HOOK_LOG: log,
});
const redirected = new Set(readFileSync(log, "utf8").split("\n").filter(Boolean)).size;
const fresh = [...planted].filter((name) => !baseline.has(name));

console.log(`${redirected} file(s) read from the copy, ${baseline.size} red before, ${fresh.length} red after that were not.`);
if (redirected === 0) console.log("Nothing was redirected: this run measured the real tree.");
for (const name of fresh) console.log(`  ${name}`);
rmSync(workspace, { recursive: true, force: true });
