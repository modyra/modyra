/**
 * The most saturated colour a screen can show, and whether the package agrees with itself.
 *
 * `maxSrgbChroma` finds the edge of the gamut by binary search over `isInSrgb`, and a palette is
 * built out of what it returns: the primary of a derived theme is the seed's hue at the chroma this
 * says is available. Two exported functions, one answer, and nothing compared them.
 *
 * A binary search assumes the region it is searching is contiguous, so what this asks is whether
 * `isInSrgb` accepts anything above what `maxSrgbChroma` reports — at the six saturated corners of
 * the cube, where a gamut boundary is sharpest, and across the wheel at a fixed lightness so the
 * answer is placed rather than assumed.
 *
 * The near-miss is worth recording because it looks exactly like the defect. At blue's lightness and
 * hue the reported maximum is 0.2656 while pure blue's own chroma is 0.3132 and `isInSrgb` accepts
 * it — an eighteen percent gap, and a duller blue in every derived palette, if it were real. It is
 * not: at 0.27 the red channel is genuinely −2.3e-4 and stays negative until the corner, where the
 * round-trip error lands at −8.5e-7 and the tolerance absorbs it. The accepted point is narrower
 * than a thousandth of chroma. There is no interval of displayable colours above the reported
 * maximum, which is what a palette needs, and a scan at that resolution finds none.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const REPO = resolve(HERE, "..", "..", "..");

/** Pack the package and ask the installed copy, so the answer is the published one. */
function askStyles(scriptName) {
  const work = mkdtempSync(join(tmpdir(), "mdy-chroma-"));
  try {
    execFileSync("npm", ["pack", "--pack-destination", work, "--silent"], {
      cwd: join(REPO, "packages", "styles"),
      stdio: ["ignore", "ignore", "pipe"],
    });
    const tarball = readdirSync(work).find((name) => name.endsWith(".tgz"));
    if (!tarball) return { packed: false };

    const consumer = join(work, "consumer");
    mkdirSync(consumer, { recursive: true });
    writeFileSync(join(consumer, "package.json"), `${JSON.stringify({ name: "c", private: true, type: "module" })}\n`);
    execFileSync("npm", ["install", join(work, tarball), "--silent", "--no-audit", "--no-fund"], {
      cwd: consumer,
      stdio: ["ignore", "ignore", "pipe"],
    });

    writeFileSync(join(consumer, "ask.mjs"), readFileSync(join(HERE, scriptName), "utf8"), "utf8");
    const stdout = execFileSync(process.execPath, [join(consumer, "ask.mjs")], {
      cwd: consumer,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { packed: true, ...JSON.parse(stdout.trim()) };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

battle(
  {
    claims: ["STY-001", "A11Y-003"],
    title: "nothing more saturated than the reported maximum is displayable",
    environments: ["node"],
  },
  async (ctx) => {
    const result = askStyles("max-chroma.consumer.mjs");
    ctx.log.note("the gamut edge at six corners and across the wheel", {
      packed: result.packed,
      corners: result.rows?.length ?? 0,
      huesWithMore: result.swept?.length ?? 0,
    });

    expectClaim(result.packed === true, {
      claimIds: ["STY-001"],
      what: "the styles package could not be packed and asked",
    });

    // The control: every corner is a colour the predicate accepts at its own chroma, so the search
    // below is over a region that has something in it.
    const refused = (result.rows ?? []).filter((row) => row.ownAccepted !== true).map((row) => row.name);
    expectEqual(refused, [], {
      claimIds: ["STY-001"],
      what: "a corner of the cube is not judged to be inside sRGB, so the gamut edge is somewhere else entirely",
    });

    // And the reported maximum is itself displayable, which a binary search can get wrong by one
    // step in the other direction.
    const unusable = (result.rows ?? []).filter((row) => row.reportedAccepted !== true).map((row) => row.name);
    expectEqual(unusable, [], {
      claimIds: ["STY-001", "A11Y-003"],
      what: "the chroma reported as the maximum is not one the gamut predicate accepts",
    });

    // The question itself: is there a more saturated colour at that lightness and hue? A palette
    // asking for the most saturated primary it can have would be handed a duller one.
    for (const row of result.rows ?? []) {
      expectEqual(row.aboveCount, 0, {
        claimIds: ["A11Y-003", "STY-001"],
        what: `at ${row.name}'s lightness and hue, ${row.aboveCount} chroma(s) above the reported maximum are displayable`,
        detail: JSON.stringify(row),
      });
    }

    // And across the wheel rather than at six colours: seventy-two hues at one lightness.
    expectEqual(result.swept ?? [], [], {
      claimIds: ["A11Y-003"],
      what: "some hues have displayable colours above the maximum the package reports for them",
    });
  },
);
