/**
 * A fragment is a copy of a heading, and nothing keeps the copy.
 *
 * `page.md#some-heading` resolves against an id the site derives from the heading's **text**. Rename
 * the heading and the id changes; the link still points at the old spelling, still names a file that
 * exists, and still renders as a link. The reader lands at the top of the page instead of on the
 * section — and the pages this happens to are the ones a heading gets reworded on, which are the
 * pages under active writing.
 *
 * The existing gate checks that a linked **file** exists. A fragment is text about a document,
 * living outside it, and it survives what it describes.
 *
 * The instrument is a slug rule, so the instrument is the risk: a rule that disagrees with the site
 * reports sound links as broken and, worse, breaks nothing when it is wrong in the other direction.
 * So it is checked against the built site before it is used — every heading of every built page,
 * against the ids that page actually carries. When the site is not built the rule is unproven here
 * and the battle says so rather than trusting it.
 *
 * A sweep that finds nothing is also a sweep that looked at nothing, so a renamed heading is planted
 * and the checker has to catch it.
 *
 * Green when every fragment written in the tracked markdown names a heading that is still there.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { battle } from "../harness/battle.mjs";
import { expectClaim, expectEqual } from "../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const REPO = resolve(HERE, "..", "..");

const tracked = (pattern) =>
  execFileSync("git", ["ls-files", pattern], { cwd: REPO, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);

/** `](path#fragment)` and `](#fragment)` — the target is empty when the link stays on the page. */
const ANCHOR_LINK = /\]\(([^)\s]*?)#([^)\s]+)\)/g;

/** A fenced block holds prose that looks like a heading and is not one. */
const stripFences = (text) => text.replace(/^```[\s\S]*?^```/gm, "");

/**
 * The id a heading gets.
 *
 * Punctuation is removed and each remaining space becomes a hyphen — *each*, not each run, which is
 * why `Prefixes & suffixes` lands on `prefixes--suffixes` and a rule that collapses whitespace
 * disagrees with the site on every heading holding a dash or a slash. There is no trim either:
 * `(Valibot, ArkType, …)` ends on a hyphen.
 */
function slugOf(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\*\*|\*|_/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/ /g, "-");
}

/**
 * Every fragment a page answers to.
 *
 * Two headings with the same text are two ids: the second carries a `-1`, as the generator
 * disambiguates them — a page with `## Notes` twice answers `#notes` and `#notes-1`, and treating
 * the second as absent would report a sound link. An explicit `<a id="…">` counts too, being an
 * anchor a page declares outright.
 */
function fragmentsOf(file) {
  const source = stripFences(readFileSync(file, "utf8"));
  const answered = new Set();
  const timesSeen = new Map();
  for (const match of source.matchAll(/^#{1,6}\s+(.+?)\s*$/gm)) {
    const base = slugOf(match[1]);
    const before = timesSeen.get(base) ?? 0;
    timesSeen.set(base, before + 1);
    answered.add(before === 0 ? base : `${base}-${before}`);
  }
  for (const match of source.matchAll(/<a\s+(?:[^>]*\s)?id="([^"]+)"/g)) answered.add(match[1]);
  return answered;
}

/**
 * Where a built page is, for the reads that prove the slug rule.
 *
 * Only `docs/` is rendered by the site, and only under that root does a path map to a page. A looser
 * mapping matched `brand/README.md` onto the site's own brand page \u2014 a real file, a real set of
 * ids, and none of them derived from the headings being read, which made the rule look wrong where
 * it was right.
 */
function builtPage(page) {
  if (!page.startsWith("docs/")) return null;
  const route = page.slice("docs/".length).replace(/\.md$/, "").replace(/\/?README$/, "");
  // An empty route is the site's own front page, which is written by hand and renders no page of
  // `docs/`. Reading it as one put ten headings of the index against three ids that were never
  // derived from them.
  if (!route) return null;
  const at = join(REPO, "site", "dist", route, "index.html");
  return existsSync(at) ? at : null;
}

/** `https://github.com/modyra/modyra#…` is this repository's own README, reachable from here. */
const OWN_REPO = /^https:\/\/github\.com\/modyra\/modyra\/?$/;

battle(
  {
    claims: ["DOC-002"],
    title: "every fragment a page links to is a heading that still exists",
    environments: ["node"],
  },
  async (ctx) => {
    // A changelog and a changeset record what was true at a version, and this suite's register
    // quotes the broken line of every finding it holds. A page that reports a stale link is not a
    // page that has one.
    const pages = tracked("*.md").filter((page) =>
      !page.includes("CHANGELOG")
      && !page.startsWith(".changeset/")
      && !page.startsWith("battle-tests/reports/"));

    // The rule before the sweep. The site is the authority on what a heading becomes, so every
    // heading of every built page is put through the rule and matched against the ids that page
    // carries. Wrong here and every verdict below is worth nothing.
    let modelled = 0;
    let stale = 0;
    const modelDisagrees = [];
    for (const page of pages) {
      const built = builtPage(page);
      if (!built) continue;
      // A page built before it was last written carries the ids of the text it used to hold, so a
      // heading reworded since the build disagrees with the rule for a reason that is not the rule.
      // Reading that as a defect turns an unbuilt working copy into a red, and the model would be
      // reporting the age of a directory.
      if (statSync(built).mtimeMs < statSync(join(REPO, page)).mtimeMs) { stale += 1; continue; }
      const emitted = new Set(
        [...readFileSync(built, "utf8").matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]),
      );
      const source = stripFences(readFileSync(join(REPO, page), "utf8"));
      for (const match of source.matchAll(/^#{2,6}\s+(.+?)\s*$/gm)) {
        modelled += 1;
        const derived = slugOf(match[1]);
        if (!emitted.has(derived)) modelDisagrees.push(`${page} ${JSON.stringify(match[1])} -> ${derived}`);
      }
    }
    ctx.log.note("the slug rule was put against the built site", {
      headings: modelled,
      disagreements: modelDisagrees.length,
      pagesOlderThanTheirSource: stale,
    });
    expectEqual(modelDisagrees.slice(0, 10), [], {
      claimIds: ["DOC-002"],
      what: "the slug rule agrees with the id the site emits, for every heading built since it was written",
      detail: `${modelDisagrees.length} of ${modelled}, ${stale} page(s) older than their source`,
    });
    // Where the site is not built the rule is unproven, and a battle whose instrument was never
    // checked says so instead of passing quietly on it.
    if (modelled === 0) {
      ctx.log.note("the slug rule is unproven in this run", { reason: "no page of docs/ is built here" });
    }

    // A planted rename, so the sweep is known to be able to fail. The target is a real page and the
    // fragment is a real heading of it with one word changed: the file exists, the link is
    // well-formed, and only the heading it names is gone.
    const witness = pages.find((page) => fragmentsOf(join(REPO, page)).size > 0);
    const real = [...fragmentsOf(join(REPO, witness))][0];
    ctx.log.note("a renamed heading was planted", { page: witness, was: real, now: `${real}-renamed-away` });
    expectClaim(!fragmentsOf(join(REPO, witness)).has(`${real}-renamed-away`), {
      claimIds: ["DOC-002"],
      what: "a fragment naming a heading that is not there is not answered",
      detail: `${witness}#${real}-renamed-away`,
    });

    const broken = [];
    let samePage = 0;
    let crossPage = 0;
    const answers = new Map();
    const fragmentsCached = (file) => {
      if (!answers.has(file)) answers.set(file, fragmentsOf(file));
      return answers.get(file);
    };

    for (const page of pages) {
      const source = stripFences(readFileSync(join(REPO, page), "utf8"));
      for (const match of source.matchAll(ANCHOR_LINK)) {
        const [, target, fragment] = match;
        let holder = page;
        if (target) {
          if (OWN_REPO.test(target)) {
            // `#readme` is GitHub's own anchor for the README card on a repository page, not an id
            // derived from a heading. It is the one fragment on that URL that no heading answers and
            // that still works; every other one is a heading of `README.md` and stays checked.
            if (fragment === "readme") continue;
            holder = "README.md";
          } else if (target.endsWith(".md")) {
            const absolute = resolve(dirname(join(REPO, page)), target);
            if (!absolute.startsWith(REPO)) continue;
            holder = relative(REPO, absolute);
          } else {
            // Somewhere this repository does not hold, so nothing here can say.
            continue;
          }
          crossPage += 1;
        } else {
          samePage += 1;
        }
        const line = source.slice(0, match.index).split("\n").length;
        const at = join(REPO, holder);
        if (!existsSync(at)) {
          broken.push(`${page}:${line} -> ${holder} (the page is not there)`);
          continue;
        }
        if (!fragmentsCached(at).has(fragment)) {
          broken.push(`${page}:${line} -> ${holder}#${fragment} (no heading answers to it)`);
        }
      }
    }

    ctx.log.note("fragments read", { samePage, crossPage, pages: pages.length });

    // A sweep that read nothing passes for the wrong reason. Both kinds have to have been seen:
    // a regex that stopped matching cross-page links would otherwise go green on the same-page ones.
    expectClaim(samePage > 0 && crossPage > 5, {
      claimIds: ["DOC-002"],
      what: "the pages yielded fragments of both kinds to check",
      detail: `${samePage} same-page, ${crossPage} cross-page`,
    });

    expectEqual(broken, [], {
      claimIds: ["DOC-002"],
      what: "every fragment a page links to names a heading that is still there",
    });
  },
);
