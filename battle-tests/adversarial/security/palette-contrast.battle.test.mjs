/**
 * Every brand colour a consumer might pick, and whether its labels can be read.
 *
 * A palette is one colour and a set of relationships: `derivePalette` takes whatever brand colour an
 * application chose and produces the surfaces and the text that sits on them. So the readability of
 * a shipped theme is not a property of the colours the project picked — it is a property of the
 * arithmetic, over every colour it will ever be given.
 *
 * ADR 0015 sets the floor at 3.5:1 deliberately, and `MDY_ON_COLOR_FLOOR` publishes it. This walks
 * the hue circle at five lightness and saturation combinations through every palette model and
 * checks each surface against the text meant to sit on it.
 *
 * The margin is what makes it worth pinning: the worst pair in the sweep clears the floor by a
 * thousandth. The engine solves *to* the floor rather than comfortably above it, so a change that
 * moved any colour by two thousandths would put a shipped theme's label under it — and nothing
 * measured that until now.
 *
 * `@modyra/styles` is not linked into the workspace root, so this reaches it the way a consumer
 * does: `npm pack`, then `npm install` into a project that has never seen this repository. That is
 * also the only way to reach it at all from here, which is why the package had no battle before.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const REPO = resolve(HERE, "..", "..", "..");

/** The sweep, run inside the installed consumer so the package is reached as one. */
const SWEEP = `
import { derivePalette, contrastRatio, MDY_ON_COLOR_FLOOR, MDY_PALETTE_MODELS } from "@modyra/styles";

const PAIRS = [["primary", "onPrimary"], ["secondary", "onSecondary"],
               ["tertiary", "onTertiary"], ["error", "onError"]];

// A brand colour from a hue, a saturation and a lightness, so the sweep covers the wheel rather
// than a handful of colours somebody liked.
const brandAt = (hue, saturation, lightness) => {
  const a = saturation * Math.min(lightness, 1 - lightness);
  const channel = (n) => {
    const k = (n + hue / 30) % 12;
    const c = lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return "#" + channel(0) + channel(8) + channel(4);
};

let checked = 0;
let refused = 0;
const under = [];
let worst = { ratio: Infinity };

for (const [name, model] of Object.entries(MDY_PALETTE_MODELS)) {
  for (let hue = 0; hue < 360; hue += 5) {
    for (const [saturation, lightness] of [[0.9, 0.5], [0.55, 0.35], [0.3, 0.7], [1, 0.25], [0.15, 0.9]]) {
      const brand = brandAt(hue, saturation, lightness);
      const palette = derivePalette(brand, model);
      if (!palette) { refused += 1; continue; }
      for (const [surface, text] of PAIRS) {
        checked += 1;
        const ratio = contrastRatio(palette[surface], palette[text]);
        if (ratio < worst.ratio) {
          worst = { ratio, model: name, brand, pair: surface + "/" + text,
                    surface: palette[surface], text: palette[text] };
        }
        if (ratio < MDY_ON_COLOR_FLOOR) {
          under.push({ model: name, brand, pair: surface + "/" + text, ratio });
        }
      }
    }
  }
}

console.log(JSON.stringify({ checked, refused, under: under.slice(0, 5), underCount: under.length,
                             worst, floor: MDY_ON_COLOR_FLOOR }));
`;

/** Pack the package and run the sweep against the installed copy. */
function runInStylesConsumer(script) {
  const work = mkdtempSync(join(tmpdir(), "mdy-styles-"));
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

    writeFileSync(join(consumer, "sweep.mjs"), script, "utf8");
    const stdout = execFileSync(process.execPath, [join(consumer, "sweep.mjs")], {
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
    claims: ["A11Y-003"],
    title: "no brand colour produces a label that cannot be read",
    environments: ["node"],
  },
  async (ctx) => {
    const result = runInStylesConsumer(SWEEP);
    ctx.log.note("a palette swept over the hue circle, from an installed package", {
      checked: result.checked,
      worst: result.worst,
    });

    expectClaim(result.packed === true, {
      claimIds: ["A11Y-003"],
      what: "the styles package could not be packed and installed",
    });

    // The control: a sweep that derived nothing would report no failures for the best possible
    // reason. Every model has to have answered for every colour it was given.
    expectClaim(result.checked > 5000 && result.refused === 0, {
      claimIds: ["A11Y-003"],
      what: "the sweep did not derive a palette for every colour it walked",
      detail: `${result.checked} pair(s) checked, ${result.refused} palette(s) refused`,
    });

    expectClaim(result.underCount === 0, {
      claimIds: ["A11Y-003"],
      what: "a brand colour produced text below the declared contrast floor",
      detail: JSON.stringify(result.under),
    });

    // And the margin, recorded rather than asserted as a threshold of its own: the engine solves to
    // the floor, so this number is how much room a change to the arithmetic has before a shipped
    // theme becomes unreadable. It was a thousandth when this was written.
    ctx.log.note("how much room the worst pair has", {
      floor: result.floor,
      worst: result.worst.ratio,
      margin: Number((result.worst.ratio - result.floor).toFixed(4)),
    });

    expectClaim(result.worst.ratio >= result.floor, {
      claimIds: ["A11Y-003"],
      what: "the closest pair in the sweep sits under the floor",
      detail: JSON.stringify(result.worst),
    });
  },
);

/** Ask the gamut predicate about the colours sRGB is defined by. */
const CORNERS = `
import { derivePalette, hexToOklch, isInSrgb, oklchToLinearRgb } from "@modyra/styles";

/** The eight corners of the sRGB cube, which are in sRGB by construction. */
const CORNERS = [
  "#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff", "#ffff00", "#00ffff", "#ff00ff",
];

/** How far past [0, 1] a channel went, after the round trip the predicate is asked about. */
const overshoot = (hex) => {
  const linear = oklchToLinearRgb(hexToOklch(hex));
  return Math.max(...Object.values(linear).map((channel) => Math.max(channel - 1, -channel)));
};

const corners = CORNERS.map((hex) => ({
  hex,
  inSrgb: isInSrgb(oklchToLinearRgb(hexToOklch(hex))),
  overshoot: overshoot(hex),
  atLooserTolerance: isInSrgb(oklchToLinearRgb(hexToOklch(hex)), 1e-6),
}));

/** And what a palette derived from each corner contains, since a seed passes through as primary. */
const palettes = CORNERS.map((hex) => {
  const palette = derivePalette(hex);
  const colours = Object.entries(palette).filter(([, value]) => typeof value === "string" && value.startsWith("#"));
  return {
    seed: hex,
    rejected: colours
      .filter(([, value]) => !isInSrgb(oklchToLinearRgb(hexToOklch(value))))
      .map(([role, value]) => role + "=" + value),
  };
});

console.log(JSON.stringify({ corners, palettes }));
`;

battle(
  {
    claims: ["STY-001"],
    title: "the gamut predicate admits the colours the gamut is defined by",
    environments: ["node"],
  },
  async (ctx) => {
    // `isInSrgb` answers whether a colour can be shown, and it is asked after a round trip through
    // Oklch — so it carries a tolerance for that transform's own error. The eight corners of the
    // cube are the cases where the answer is not a judgement: they are sRGB.
    //
    // The tolerance is 1e-7 and the round trip's error is larger than that for two of them, so the
    // predicate says a colour that came from sRGB is not in it. White clears the same threshold by
    // a factor of one and a half, which is close enough to say the margin is luck rather than a
    // margin.
    const result = runInStylesConsumer(CORNERS);

    try {
      expectClaim(result.packed === true, {
        claimIds: ["STY-001"],
        what: "@modyra/styles could not be packed and installed",
      });

      const { corners, palettes } = result;
      ctx.log.note("what the predicate said about each corner", {
        corners: corners.map((each) => [each.hex, each.inSrgb, each.overshoot.toExponential(3)]),
      });

      // The known-good cases, in the same run: most corners are admitted, so the predicate is
      // answering about the colour rather than rejecting everything it is handed.
      const admitted = corners.filter((each) => each.inSrgb);
      expectClaim(admitted.length >= 5, {
        claimIds: ["STY-001"],
        what: "the predicate rejects most of the cube, so it is not answering about these colours in particular",
        detail: JSON.stringify(corners.map((each) => [each.hex, each.inSrgb])),
      });

      const rejected = corners
        .filter((each) => !each.inSrgb)
        .map((each) => ({ hex: each.hex, overshoot: each.overshoot.toExponential(3), atLooserTolerance: each.atLooserTolerance }));

      expectEqual(rejected, [], {
        claimIds: ["STY-001"],
        what: "a corner of sRGB was judged to be outside sRGB",
        detail: JSON.stringify(rejected),
      });

      // And the consequence for a consumer: a seed passes through a palette as its primary, so the
      // package emits a colour its own predicate rejects.
      const emitted = palettes.filter((each) => each.rejected.length > 0);
      expectEqual(emitted, [], {
        claimIds: ["STY-001"],
        what: "a derived palette contains a colour the package's own gamut predicate rejects",
        detail: JSON.stringify(emitted),
      });
    } finally {
      // The runner removes its own working directory.
    }
  },
);
