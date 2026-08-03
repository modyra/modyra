/**
 * The icon set holds to its own rule.
 *
 * A set drifts one well-meant icon at a time, and this one had: four grids (12, 16, 20, 24) with
 * strokes rendering between 1.20px and 2.00px at the same box size, and glyphs filling anywhere
 * from 42% to 83% of their grid. Every icon looked fine alone. Only side by side did they read as
 * borrowed from different sets — which is exactly where a user meets them, in a column down a form.
 *
 * So the rule is asserted rather than intended. These checks are the reason the redraw is worth
 * anything: without them the set is one merge away from drifting again.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MDY_ICONS,
  MDY_ICON_GRID,
  MDY_ICON_SPANS,
  MDY_ICON_STROKE,
} from "../dist/icons.js";

const NAMES = Object.keys(MDY_ICONS);

/** Every coordinate a glyph's geometry mentions, so its extent can be measured. */
function extent(content) {
  const xs = [];
  const ys = [];

  for (const m of content.matchAll(/<circle[^>]*cx="([\d.]+)"[^>]*cy="([\d.]+)"[^>]*r="([\d.]+)"/g)) {
    const [cx, cy, r] = [+m[1], +m[2], +m[3]];
    xs.push(cx - r, cx + r);
    ys.push(cy - r, cy + r);
  }
  for (const m of content.matchAll(/<rect[^>]*x="([\d.]+)"[^>]*y="([\d.]+)"[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"/g)) {
    xs.push(+m[1], +m[1] + +m[3]);
    ys.push(+m[2], +m[2] + +m[4]);
  }
  // Path data: absolute commands carry coordinates, relative ones accumulate from the last point.
  for (const m of content.matchAll(/ d="([^"]+)"/g)) {
    let x = 0;
    let y = 0;
    for (const seg of m[1].matchAll(/([MmLlHhVv])\s*([-\d.\s,]*)/g)) {
      const cmd = seg[1];
      const n = (seg[2].match(/-?[\d.]+/g) ?? []).map(Number);
      const rel = cmd === cmd.toLowerCase();
      if (cmd.toUpperCase() === "H") {
        for (const v of n) { x = rel ? x + v : v; xs.push(x); ys.push(y); }
      } else if (cmd.toUpperCase() === "V") {
        for (const v of n) { y = rel ? y + v : v; xs.push(x); ys.push(y); }
      } else {
        for (let i = 0; i + 1 < n.length; i += 2) {
          x = rel ? x + n[i] : n[i];
          y = rel ? y + n[i + 1] : n[i + 1];
          xs.push(x);
          ys.push(y);
        }
      }
    }
  }
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

test("every icon is on the same grid", () => {
  for (const name of NAMES) {
    assert.equal(MDY_ICONS[name].viewBox, `0 0 ${MDY_ICON_GRID} ${MDY_ICON_GRID}`, name);
  }
});

test("every stroke is the same weight", () => {
  // The defect this replaces: strokes of 1.5, 2 and 2.5 on grids of 12, 16, 20 and 24, which is a
  // 67% spread in apparent line weight once each is drawn into the same box.
  for (const name of NAMES) {
    const widths = [...MDY_ICONS[name].content.matchAll(/stroke-width="([\d.]+)"/g)].map((m) => m[1]);
    assert.ok(widths.length > 0, `${name} declares no stroke`);
    for (const w of widths) assert.equal(Number(w), MDY_ICON_STROKE, `${name} stroke-width`);
  }
});

test("every icon declares a span class, and fills it", () => {
  for (const name of NAMES) {
    const icon = MDY_ICONS[name];
    const span = MDY_ICON_SPANS[icon.span];
    assert.ok(span, `${name} declares an unknown span class: ${icon.span}`);

    const e = extent(icon.content);
    const width = e.maxX - e.minX;
    const height = e.maxY - e.minY;

    // The glyph fills its class in at least one dimension — a chevron is wide and short, a minus is
    // wide and flat, and neither should be forced square. What is checked is that it reaches the
    // span its class promises rather than sitting well inside it.
    assert.ok(
      Math.abs(Math.max(width, height) - span) <= 0.5,
      `${name}: ${icon.span} promises span ${span}, measured ${Math.max(width, height).toFixed(1)}`,
    );
  }
});

test("nothing is drawn outside the live area", () => {
  // 2..22. A glyph reaching the edge of the box has no room for its own stroke and reads as clipped
  // next to one that does.
  for (const name of NAMES) {
    const e = extent(MDY_ICONS[name].content);
    assert.ok(e.minX >= 2 && e.minY >= 2, `${name} starts before 2: ${e.minX},${e.minY}`);
    assert.ok(e.maxX <= 22 && e.maxY <= 22, `${name} passes 22: ${e.maxX},${e.maxY}`);
  }
});

test("every icon is centred on the grid", () => {
  // Off-centre glyphs are what make a column of affordances look ragged even when their boxes agree.
  for (const name of NAMES) {
    const e = extent(MDY_ICONS[name].content);
    const cx = (e.minX + e.maxX) / 2;
    const cy = (e.minY + e.maxY) / 2;
    assert.ok(Math.abs(cx - 12) <= 0.5, `${name} horizontal centre ${cx.toFixed(1)}`);
    assert.ok(Math.abs(cy - 12) <= 0.5, `${name} vertical centre ${cy.toFixed(1)}`);
  }
});

test("round caps and joins, everywhere", () => {
  for (const name of NAMES) {
    const content = MDY_ICONS[name].content;
    const shapes = [...content.matchAll(/<(circle|rect|path)[^>]*>/g)].map((m) => m[0]);
    for (const shape of shapes) {
      assert.match(shape, /stroke-linecap="round"/, `${name}: ${shape.slice(0, 40)}`);
      assert.match(shape, /stroke-linejoin="round"/, `${name}: ${shape.slice(0, 40)}`);
    }
  }
});

test("no icon is a text glyph or an emoji", () => {
  // Icons are geometry. A character rendered as an icon takes the reader's font, not the theme's
  // stroke, and lands wherever that font's metrics put it.
  for (const name of NAMES) {
    const content = MDY_ICONS[name].content;
    assert.doesNotMatch(content, /<text\b/, `${name} draws a text node`);
    assert.ok(
      !/[\u{1F300}-\u{1FAFF}\u{2190}-\u{27BF}\u{2B00}-\u{2BFF}]/u.test(content),
      `${name} contains a pictographic character`,
    );
  }
});
