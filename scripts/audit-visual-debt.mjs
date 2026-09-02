/**
 * A page the visual suite photographs cannot move without its linux images.
 *
 * Baselines are recorded per platform, and one of the two platforms is not the one anybody works on:
 * `-linux.png` can only be produced where the suite runs. So a change to a demo page is re-recorded
 * on the author's machine, the other half stays where it was, and CI goes red an hour later at a
 * reader who has to diagnose from pixels what the author already knew.
 *
 * That happened three times in one day — the range frames, the Lit demo, the plain lab — each time
 * with the same shape and each time discovered rather than declared. Both authors then wrote the
 * debt into the commit body, which is the right thing and is discipline: it depends on remembering,
 * and the whole reason this keeps happening is that nobody is prompted at the moment they could act.
 *
 * So this asks the question at commit time, in git's own terms: **for each renderer the suite
 * photographs, is the last commit that touched its pages an ancestor of the last commit that touched
 * its linux baselines?** If it is not, the images are behind the page and the run that fixes it is
 * named here rather than left to be worked out.
 *
 * Existence is asked before order, and that distinction is not pedantry: `git log -- <path>` reports
 * the commit that *deleted* a file as readily as the one that wrote it, so a renderer whose linux
 * baselines were all removed reads as perfectly current — the deletion is the most recent commit
 * touching them and it is a descendant of everything. The images are gone and the gate is green.
 * So the tracked files are counted at HEAD first; only something that exists can be behind.
 *
 * Ancestry rather than timestamps: a rebase rewrites dates, and two commits made a second apart on
 * two machines say nothing about which came first. `git merge-base --is-ancestor` answers the
 * question that is actually being asked — was this recorded after that change.
 *
 * **It announces; it does not bar the way, and that is the design rather than a softening.** The linux
 * images can only be recorded from a pushed head, so the debt is legitimate for as long as it takes to
 * push and run the recorder. A gate that refused the commit would be asking for images that cannot
 * exist until the commit does — a deadlock, and the way around a deadlock is `--no-verify`, which
 * costs the check its credibility for every other thing it might have said. Announcing at the moment
 * the author can still act is the whole value; refusing adds nothing to it.
 *
 * `--check` exists for a caller that wants the exit code — a reviewer asking "does this head owe
 * images". It is deliberately not wired into the commit path or into `test:contracts`, where the same
 * deadlock would reappear as a red on a state that is allowed to be true.
 *
 * **Two questions, because the first one misses the commonest case.** Comparing commits answers
 * "did the page move after its images were taken". It says nothing when a *new shot* is added: the
 * declaration lives in the spec, not under `examples/`, so a suite that gained a subject and
 * recorded only the platform at hand reads as perfectly current. That is not hypothetical — the
 * daterange calendar shot was added with 24 darwin images and no linux twin, and this check said
 * `NO VISUAL DEBT`.
 *
 * So it also asks the direct question: **does every image have its twin on the other platform?** A
 * name recorded for one platform and not the other is a comparison that cannot happen, whatever the
 * commits say.
 *
 * Usage:
 *   node scripts/audit-visual-debt.mjs            # report
 *   node scripts/audit-visual-debt.mjs --check    # and exit 1 on a debt
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();

/** The last commit that touched anything under these paths, or null when nothing ever did. */
function lastCommitTouching(paths) {
  const out = git("log", "-1", "--format=%H", "--", ...paths);
  return out === "" ? null : out;
}

const isAncestor = (older, newer) => {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", older, newer], { cwd: ROOT });
    return true;
  } catch {
    return false;
  }
};

/**
 * Which renderers the suite photographs, and where their pages live.
 *
 * Read from the specs rather than listed here: a renderer that gains a visual suite tomorrow is
 * covered the day it lands, and one that loses it stops being asked about. The spec's own `at`
 * decides nothing here — whatever page it names is served from that renderer's example directory,
 * so the directory is the subject either way.
 */
const renderers = readdirSync(join(ROOT, "e2e"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => existsSync(join(ROOT, "e2e", name, "visual.spec.ts")))
  .filter((name) => existsSync(join(ROOT, "examples", name)));

const debts = [];
const rows = [];

/** Snapshot names, stripped of the platform suffix, grouped by the platforms that carry them. */
function twinsOf(renderer) {
  const dir = join("e2e", renderer, "visual.spec.ts-snapshots");
  const tracked = git("ls-files", "--", `:(glob)${dir}/*.png`).split("\n").filter(Boolean);
  const byName = new Map();
  for (const file of tracked) {
    const base = file.split("/").pop();
    const match = base.match(/^(.*)-(darwin|linux)\.png$/);
    if (!match) continue;
    const [, name, platform] = match;
    byName.set(name, { ...(byName.get(name) ?? {}), [platform]: true });
  }
  return byName;
}

for (const renderer of renderers) {
  const snapshots = join("e2e", renderer, "visual.spec.ts-snapshots");
  const pages = lastCommitTouching([join("examples", renderer)]);
  // Pathspecs rather than a glob the shell would expand: the platform is in the file name, so this
  // asks git for exactly the linux half and nothing else.
  const linux = lastCommitTouching([`:(glob)${snapshots}/*-linux.png`]);
  const recorded = git("ls-files", "--", `:(glob)${snapshots}/*-linux.png`)
    .split("\n").filter(Boolean).length;

  if (pages === null) continue;
  if (recorded === 0) {
    debts.push(`${renderer}: its pages are photographed and it carries no linux baseline at all`
      + (linux === null ? " (none was ever recorded)" : " (they were recorded and then removed)"));
    continue;
  }
  const twins = twinsOf(renderer);
  const darwinOnly = [...twins].filter(([, on]) => on.darwin && !on.linux).map(([name]) => name);
  const linuxOnly = [...twins].filter(([, on]) => on.linux && !on.darwin).map(([name]) => name);
  if (darwinOnly.length > 0) {
    debts.push(`${renderer}: ${darwinOnly.length} image(s) recorded on darwin with no linux twin `
      + `(e.g. ${darwinOnly.slice(0, 2).join(", ")})`);
  }
  if (linuxOnly.length > 0) {
    debts.push(`${renderer}: ${linuxOnly.length} image(s) recorded on linux with no darwin twin `
      + `(e.g. ${linuxOnly.slice(0, 2).join(", ")})`);
  }

  const current = isAncestor(pages, linux);
  rows.push(`  ${renderer.padEnd(10)} ${String(recorded).padStart(3)} linux image(s)  `
    + `pages ${pages.slice(0, 8)}  linux ${linux.slice(0, 8)}  ${current ? "current" : "BEHIND"}`);
  if (!current) {
    debts.push(`${renderer}: the linux baselines were recorded before the last change to its pages `
      + `(pages ${pages.slice(0, 8)}, linux ${linux.slice(0, 8)})`);
  }
}

console.log("# Visual baseline debt\n");
console.log(`Renderers the suite photographs: ${renderers.join(", ") || "(none)"}`);
console.log(rows.join("\n"));

if (debts.length === 0) {
  console.log("\nNO VISUAL DEBT — every linux baseline was recorded after the page it photographs.");
} else {
  console.log(`\nVISUAL DEBT — ${debts.length}\n`);
  for (const debt of debts) console.log(`  - ${debt}`);
  console.log(
    "\n  These images cannot be recorded where you are working: they are taken where the suite runs."
    + "\n  Push the change, then run the recorder against the published head:"
    + "\n\n      gh workflow run visual-baselines.yml --ref main"
    + "\n\n  and commit the `-linux.png` files from its artifact. Until then CI is red on those"
    + "\n  images and on nothing else — say so in the commit body so the next reader is told rather"
    + "\n  than left to diagnose it.",
  );
  if (CHECK) process.exit(1);
}
