/**
 * The certificate `contrastOf` was missing.
 *
 * `contrastOf` reports the contrast between a mark and the region it sits in by taking the painted
 * pixel **furthest in luminance from the background**. That is the right pixel when the mark has one:
 * a stroke wide enough to cover a whole pixel column paints at least one pixel of pure ink.
 *
 * Its header has carried a warning since it was written — *unvalidated on thin strokes, do not file
 * from it* — after a first run gave a minus sign 2.98:1 and a plus sign 6.78:1 in one control, in one
 * colour. That is far more likely to be the thinner stroke having no opaque pixel than two inks.
 *
 * **This is the fixture that turns the warning into a boundary.** A mark of known ink on a known
 * background is synthesised at several stroke weights, so the ratio the instrument *should* report is
 * arithmetic rather than a second measurement. Nothing is rendered: the pixels are written here, which
 * is what makes "measured equals computed" a statement about the instrument and not about a browser.
 *
 * **The boundary turns out not to be the width.** It is whether any pixel is fully covered:
 *
 *     4, 2, 1 device px aligned to the grid   one or more columns fully covered      exact
 *     1 device px on a half-pixel boundary    two columns at 50%                     reads low
 *     half a device px                        one column at 50%                      reads low
 *
 * So a 1px stroke is measurable or not depending on where it lands, which no rule about weight can
 * express. What the instrument needs is not a wider mark but **one opaque pixel**, and that is the
 * sentence its header should carry.
 *
 * Anti-aliasing is modelled the way a rasteriser does it — coverage-weighted blending of ink over
 * background — so the blended values here are the ones a real thin stroke produces.
 *
 * **What this certifies, and what it does not.** It certifies the arithmetic: the instrument computes
 * the right ratio *given* pixels. It cannot certify the capture — that a browser's rasteriser hands it
 * opaque interiors at a given density is inference from how coverage works, not a measurement, and the
 * first reading against a real capture is still the one that has not happened.
 *
 * One artifact is deliberately outside it. **Subpixel (LCD) antialiasing is a different thing from
 * coverage antialiasing**: it paints a glyph's edge using the red, green and blue subpixels
 * separately, producing coloured fringes that are neither the ink nor the background and are not on
 * the line between them. Coverage blending cannot produce one, so nothing here tests the
 * furthest-in-luminance heuristic against a fringe — and the last case below shows what happens when
 * it meets one. The capture must have subpixel antialiasing off.
 */

import { deflateSync } from "node:zlib";
import { test } from "node:test";
import assert from "node:assert/strict";

import { decodePng, contrastOf, paintedFraction } from "./what-a-region-paints.mjs";

/** The luminance term of WCAG's contrast formula, on 0–255 channels. */
function luminance(r, g, b) {
  const channel = (value) => {
    const v = value / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

const ratioBetween = (ink, back) => {
  const a = luminance(...ink);
  const b = luminance(...back);
  return Number(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2));
};

/** A minimal 8-bit RGB PNG. Filter 0 on every scanline, which `decodePng` reads. */
function encodePng(width, height, rgb) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buffer) => {
    let c = 0xffffffff;
    for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, body) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(body.length, 0);
    head.write(type, 4, "ascii");
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE(crc(Buffer.concat([Buffer.from(type, "ascii"), body])), 0);
    return Buffer.concat([head, body, tail]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // truecolour
  const raw = Buffer.alloc(height * (width * 3 + 1));
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 3 + 1)] = 0;
    for (let x = 0; x < width; x += 1) {
      const at = y * (width * 3 + 1) + 1 + x * 3;
      const [r, g, b] = rgb(x, y);
      raw[at] = r; raw[at + 1] = g; raw[at + 2] = b;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const INK = [44, 25, 61];
const BACK = [255, 255, 255];
const WIDTH = 40;
const HEIGHT = 20;

/**
 * A vertical stroke of `weight` CSS pixels whose left edge sits at `left`, blended by coverage.
 *
 * Coverage per column is the overlap between the stroke's span and that column's span, which is what
 * a rasteriser computes. A column fully inside the stroke gets pure ink; a partial one gets a blend.
 */
const strokeAt = (left, weight) => (x) => {
  const covered = Math.max(0, Math.min(x + 1, left + weight) - Math.max(x, left));
  if (covered <= 0) return BACK;
  return INK.map((channel, index) => Math.round(channel * covered + BACK[index] * (1 - covered)));
};

/**
 * `scale` is passed because the guard requires it, and the weights below are therefore **device**
 * pixels — which is what a decoded buffer holds whatever produced it.
 *
 * That makes the two limits separate and both real: the capture floor keeps a 1px *CSS* stroke from
 * arriving as half a device pixel, and this fixture shows that a mark narrower than one device pixel
 * is unmeasurable even above that floor. The floor is necessary and it is not sufficient.
 */
const measure = (left, weight) => {
  const paint = strokeAt(left, weight);
  const png = decodePng(encodePng(WIDTH, HEIGHT, (x) => paint(x)));
  return contrastOf(png, { scale: 2 });
};

const EXPECTED = ratioBetween(INK, BACK);

test("a mark with one fully covered pixel is measured exactly", () => {
  // The premise: the arithmetic this is compared against is a real contrast, not two equal colours.
  assert.ok(EXPECTED > 10, `ink and background are ${EXPECTED}:1 apart, too close to tell a defect from noise`);

  for (const weight of [4, 2, 1]) {
    const seen = measure(10, weight);
    assert.ok(seen !== null, `nothing was found at weight ${weight}`);
    assert.equal(
      seen.mark,
      INK.join(","),
      `at ${weight}px aligned to the grid the furthest pixel is ${seen.mark}, not the ink ${INK.join(",")} — `
      + "so the instrument is reporting a blend as if it were the mark",
    );
    assert.ok(
      Math.abs(seen.ratio - EXPECTED) <= 0.05,
      `at ${weight}px the instrument says ${seen.ratio}:1 where the ink and background are ${EXPECTED}:1`,
    );
  }
});

test("a mark with no fully covered pixel reads low, and by how much", () => {
  const cases = [
    ["1 device px on a half-pixel boundary", 10.5, 1],
    ["half a device px", 10, 0.5],
    ["a quarter of a device px", 10, 0.25],
  ];

  const low = [];
  for (const [name, left, weight] of cases) {
    const seen = measure(left, weight);
    assert.ok(seen !== null, `${name}: nothing was painted at all, so this case measures nothing`);
    if (seen.ratio < EXPECTED - 0.05) low.push(`${name}: ${seen.ratio}:1 against ${EXPECTED}:1, mark read as ${seen.mark}`);
  }

  // This is the boundary being recorded, not a defect being reported: the instrument cannot see an
  // ink no pixel contains. Asserting that it *does* under-report is what stops the limitation from
  // being quietly fixed and forgotten, or quietly widening.
  assert.equal(
    low.length,
    cases.length,
    `${cases.length - low.length} of these read the full ratio. If a mark with no opaque pixel is now `
    + "measured exactly, this instrument has changed and its documented floor is wrong: " + JSON.stringify(low),
  );

  // And the size of the error, so a reader knows what "reads low" costs.
  const half = measure(10, 0.5);
  assert.ok(
    half.ratio < EXPECTED / 2,
    `a 0.5px stroke reads ${half.ratio}:1 against ${EXPECTED}:1 — the under-report is smaller than `
    + "expected, so the warning in the header may be overstated",
  );
});

/**
 * The artifact the fixture above cannot produce, and what it costs.
 *
 * Coverage blending moves a pixel along the line between ink and background, so every blend is
 * *between* them and the furthest one is the ink. **Subpixel rendering does not work that way**: it
 * lights the red, green and blue subpixels by different amounts, and the result is a colour off that
 * line entirely.
 *
 * A fringe can therefore sit **further from the background than the ink is** — and then the heuristic
 * picks the fringe, and the ratio comes back **too high**. That is the dangerous direction. A thin
 * stroke under-reporting raises a false alarm somebody investigates; a fringe over-reporting clears a
 * mark that does not conform, and nobody investigates a pass.
 *
 * Written as an assertion rather than a warning so that the day the capture changes — headed, another
 * platform, a Playwright upgrade — this says what it costs instead of being a sentence someone read
 * once.
 */
test("a subpixel fringe fools the furthest-pixel heuristic, upward", () => {
  const grey = [120, 120, 120];
  const white = [255, 255, 255];
  const trueRatio = ratioBetween(grey, white);

  // A mid-grey stroke with one saturated blue fringe pixel at its edge — blue carries the least
  // luminance of the three channels, so the fringe is darker than the ink it belongs to.
  const fringed = decodePng(encodePng(WIDTH, HEIGHT, (x) => {
    if (x === 10) return [0, 0, 255];
    if (x > 10 && x < 14) return grey;
    return white;
  }));

  const seen = contrastOf(fringed, { scale: 2 });
  assert.ok(seen !== null, "nothing was painted, so this case measures nothing");

  // The premise: the fringe really is the furthest pixel. If it were not, the heuristic would be
  // unbothered and this test would be describing a hazard that does not exist.
  assert.equal(
    seen.mark,
    "0,0,255",
    `the furthest pixel is ${seen.mark}, not the fringe — this ink and fringe do not exercise the `
    + "artifact and the case needs rebuilding before it means anything",
  );

  assert.ok(
    seen.ratio > trueRatio,
    `the fringe reported ${seen.ratio}:1 where the ink is ${trueRatio}:1 — it did not over-report, so `
    + "the heuristic may be more robust than this test assumes",
  );
});

/**
 * The guards themselves, because a rule that lives in a header is one the next caller does not obey.
 *
 * Both refusals fired on this file the moment they were written — every case above called without a
 * scale and every one of them stopped. That is the evidence they work, and it is not evidence anyone
 * can see six months from now, which is what these assertions are for.
 *
 * **Each match on the message, not merely on "something was thrown".** The first draft of this test
 * did not import `paintedFraction` at all, so the call raised a `ReferenceError` — which a bare
 * `assert.throws` accepts as proof that the guard fired. The pattern is what told the two apart, and
 * a test that a refusal happens is worth nothing unless it knows *which* refusal.
 */
test("a pixel measure refuses to answer without knowing how densely it was captured", () => {
  const plain = decodePng(encodePng(4, 4, () => [255, 255, 255]));

  assert.throws(
    () => paintedFraction(plain),
    /deviceScaleFactor/,
    "paintedFraction answered without being told the capture scale",
  );
  assert.throws(
    () => contrastOf(plain, { scale: 1 }),
    /deviceScaleFactor 2 or more/,
    "contrastOf answered for pixels captured at scale 1, where a 1px stroke may have no opaque pixel",
  );
  assert.throws(
    () => contrastOf(plain),
    /deviceScaleFactor 2 or more/,
    "contrastOf answered without being told the capture scale",
  );

  // And it does answer when told, so the guard is a condition rather than a wall.
  assert.equal(paintedFraction(plain, { scale: 1 }).fraction, 0);
});
