/**
 * Two promises about the documentation that no battle was making.
 *
 * `MDY_BATTLE_CLAIMS` declares seventy-two claims and the suite names seventy of them. The two it
 * never named are the documentation ones, and both fail silently: a reader copies a line, it does
 * not resolve, and nothing in this repository was ever going to notice.
 *
 * **DOC-001 — every import a guide shows is one the package exports at runtime.** Its own stated
 * evidence is one page's snippets, run. The claim is about all of them.
 *
 * **DOC-002 — a link a reader clicks lands on the section it names.** Its own stated evidence is a
 * gate that checks the linked *file* exists. A fragment naming no heading resolves to the top of a
 * page the reader did not ask for, which is worse than a broken link because it looks like it worked.
 *
 * Neither is failing today. This was written after measuring both and finding them kept, for the
 * reason the prototype defences were pinned: a promise nobody checks stops being true on a day nobody
 * notices, and documentation drifts faster than code because nothing compiles it.
 *
 * **A type-only import is not a runtime export**, and reading one as a defect is this battle's most
 * available mistake — `import { type MdyDynamicField }` names something the type system has and the
 * runtime does not. Two false findings came out of the first measurement that way.
 *
 * Packages that cannot be loaded here are **reported, not skipped**: an adapter needing a DOM, and a
 * workspace package not resolvable from the repository root, are real limits on what this can say,
 * and a battle that swallowed them would claim coverage it does not have.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const REPO = resolve(new URL("../../../", import.meta.url).pathname);

/** Every markdown page a reader is sent to. */
function pagesUnder(directory, found = []) {
  const path = join(REPO, directory);
  if (!existsSync(path)) return found;
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const relative = join(directory, entry.name);
    if (entry.isDirectory()) pagesUnder(relative, found);
    else if (entry.name.endsWith(".md")) found.push(relative);
  }
  return found;
}

/** The heading slug a fragment resolves against. */
const slugOf = (heading) => heading.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");

battle(
  {
    claims: ["DOC-001", "DOC-002"],
    title: "a guide shows imports that resolve, and links that land",
    environments: ["node"],
  },
  async (ctx) => {
    const pages = pagesUnder("docs");

    expectClaim(pages.length > 0, {
      claimIds: ["DOC-001"],
      what: "no documentation pages were found, so this battle is comparing nothing",
      detail: () => JSON.stringify({ pages: pages.length }),
    });

    const wanted = new Map();
    for (const page of pages) {
      const text = readFileSync(join(REPO, page), "utf8");
      for (const block of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*["'](@modyra\/[^"']+)["']/g)) {
        for (const raw of block[1].split(",")) {
          const name = raw.trim();
          if (name === "" || name.startsWith("type ")) continue;
          const local = name.split(/\s+as\s+/)[0].trim();
          if (!wanted.has(block[2])) wanted.set(block[2], new Map());
          if (!wanted.get(block[2]).has(local)) wanted.get(block[2]).set(local, page);
        }
      }
    }

    const unreadable = [];
    const unexported = [];
    let checkedImports = 0;
    for (const [specifier, names] of wanted) {
      let published;
      try {
        published = await import(specifier);
      } catch (error) {
        unreadable.push(`${specifier}: ${String(error?.message ?? error).slice(0, 60)}`);
        continue;
      }
      for (const [name, page] of names) {
        checkedImports += 1;
        if (!(name in published)) unexported.push(`${page}: ${specifier} does not export ${name}`);
      }
    }

    ctx.log.note("what the guides import", { packages: wanted.size, names: checkedImports, unreadable });

    expectEqual(unexported, [], {
      claimIds: ["DOC-001"],
      what: "a guide shows an import the package does not publish, so a reader who copies the line gets nothing",
      detail: JSON.stringify(unexported, null, 1),
    });

    const headings = new Map();
    for (const page of pages) {
      const set = new Set();
      for (const line of readFileSync(join(REPO, page), "utf8").matchAll(/^#{1,6}\s+(.+?)\s*$/gm)) {
        set.add(slugOf(line[1]));
      }
      headings.set(resolve(REPO, page), set);
    }

    const landsNowhere = [];
    let checkedLinks = 0;
    for (const page of pages) {
      const text = readFileSync(join(REPO, page), "utf8");
      for (const link of text.matchAll(/\]\(([^)\s]+\.md)#([^)\s]+)\)/g)) {
        const target = resolve(dirname(resolve(REPO, page)), link[1]);
        checkedLinks += 1;
        if (!headings.has(target)) {
          landsNowhere.push(`${page}: ${link[1]} does not exist`);
          continue;
        }
        if (!headings.get(target).has(link[2].toLowerCase())) {
          landsNowhere.push(`${page}: ${link[1]} has no section "${link[2]}"`);
        }
      }
    }

    ctx.log.note("what the guides link to", { fragments: checkedLinks });

    expectClaim(checkedLinks > 0, {
      claimIds: ["DOC-002"],
      what: "no cross-file fragment link was found, so this half of the battle is comparing nothing",
      detail: () => JSON.stringify({ pages: pages.length }),
    });

    expectEqual(landsNowhere, [], {
      claimIds: ["DOC-002"],
      what: "a link names a section that does not exist, so it lands at the top of a page the reader did not ask for — which looks like it worked",
      detail: JSON.stringify(landsNowhere, null, 1),
    });
  },
);
