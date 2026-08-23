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
 *     4px, 2px, 1px aligned to the grid    one or more columns at full coverage   exact
 *     1px on a half-pixel boundary         two columns at 50%                     reads low
 *     0.5px                                one column at 50%                      reads low
 *
 * So a 1px stroke is measurable or not depending on where it lands, which no rule about weight can
 * express. What the instrument needs is not a wider mark but **one opaque pixel**, and that is the
 * sentence its header should carry.
 *
 * Anti-aliasing is modelled the way a rasteriser does it — coverage-weighted blending of ink over
 * background — so the blended values here are the ones a real thin stroke produces.
 */

import { deflateSync } from "node:zlib";
import { test } from "node:test";
import assert from "node:assert/strict";

import { decodePng, contrastOf } from "./what-a-region-paints.mjs";

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

const measure = (left, weight) => {
  const paint = strokeAt(left, weight);
  const png = decodePng(encodePng(WIDTH, HEIGHT, (x) => paint(x)));
  return contrastOf(png);
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
    ["1px on a half-pixel boundary", 10.5, 1],
    ["0.5px", 10, 0.5],
    ["0.25px", 10, 0.25],
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
