/**
 * Runs inside a packed consumer, not in the suite.
 *
 * Asks `maxSrgbChroma` for the most saturated colour sRGB can show at a lightness and a hue, and
 * then asks `isInSrgb` whether a more saturated one exists there. The seeds are the six saturated
 * corners of the cube, because a corner is where a gamut boundary is sharpest, and a sweep of hues
 * beside them so the answer is not about six colours somebody chose.
 */

import { hexToOklch, isInSrgb, maxSrgbChroma, oklchToLinearRgb } from "@modyra/styles";

const CORNERS = {
  red: "#ff0000",
  green: "#00ff00",
  blue: "#0000ff",
  cyan: "#00ffff",
  magenta: "#ff00ff",
  yellow: "#ffff00",
};

const inGamutAt = (l, c, h) => isInSrgb(oklchToLinearRgb({ l, c, h }));

const rows = [];

for (const [name, hex] of Object.entries(CORNERS)) {
  const { l, c, h } = hexToOklch(hex);
  const reported = maxSrgbChroma(l, h);

  // Is there a chroma above the reported maximum that the package's own predicate accepts? The
  // colour's own chroma is the first place to look, and a scan covers the rest.
  const above = [];
  for (let candidate = reported + 0.001; candidate <= 0.45; candidate += 0.001) {
    if (inGamutAt(l, candidate, h)) above.push(Number(candidate.toFixed(4)));
  }

  rows.push({
    name,
    lightness: Number(l.toFixed(4)),
    hue: Number(h.toFixed(2)),
    ownChroma: Number(c.toFixed(4)),
    reported: Number(reported.toFixed(4)),
    ownAccepted: inGamutAt(l, c, h),
    reportedAccepted: inGamutAt(l, reported, h),
    aboveReported: above.slice(0, 6),
    aboveCount: above.length,
  });
}

// And a sweep of the wheel at a fixed lightness, so the finding is placed rather than assumed to be
// everywhere or nowhere.
const swept = [];
for (let hue = 0; hue < 360; hue += 5) {
  const reported = maxSrgbChroma(0.45, hue);
  let higher = 0;
  for (let candidate = reported + 0.002; candidate <= 0.45; candidate += 0.002) {
    if (inGamutAt(0.45, candidate, hue)) higher += 1;
  }
  if (higher > 0) swept.push({ hue, reported: Number(reported.toFixed(4)), higher });
}

console.log(JSON.stringify({ rows, swept }));
