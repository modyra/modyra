/**
 * Runtime contract conformance for the Plain renderer.
 *
 * `assertWidgetDomContract` comes from `@modyra/widgets/testing` and is the same gate the other
 * adapters answer to: it checks the rendered DOM against the catalog's classes, containment,
 * sibling order and ARIA — not that the source mentions the contract.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { mountMdyForm } = await import("../dist/index.js");
const { inspectWidgetDom } = await import("../../widgets/dist/testing/index.js");
const { ABSENT, FIELDS, KNOWN_DIVERGENCES, partsOf } = await import("./contract-parts.mjs");

test("every rendered field conforms to its widget DOM contract", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const mounted = mountMdyForm(host, FIELDS, { submitLabel: null });

  for (const field of FIELDS) {
    const root = host.querySelector(`[data-mdy-field="${field.name}"]`);
    assert.ok(root, `${field.kind} rendered no root`);
    const issues = inspectWidgetDom(root, field.kind, {
      parts: partsOf(root, field.kind),
      absentParts: ABSENT[field.kind] ?? [],
    });
    // Exact match, both ways: a new violation fails, and so does a stale entry left behind by a
    // renderer batch that already fixed it.
    assert.deepEqual(
      issues.map((issue) => `${issue.code}:${issue.part}`),
      KNOWN_DIVERGENCES[field.kind] ?? [],
      `${field.kind}: ${issues.map((issue) => issue.message).join(" / ")}`,
    );
  }

  mounted.dispose();
  host.remove();
});

test("the shell emits the canonical class vocabulary, not adapter equivalents", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const mounted = mountMdyForm(host, [{ name: "a", kind: "text", label: "A" }], { submitLabel: null });

  const root = host.querySelector(".mdy-renderer");
  for (const className of ["mdy-label", "mdy-label__required", "mdy-input-wrapper", "mdy-input-wrapper__inliner", "mdy-supporting-text", "mdy-control__errors"]) {
    assert.ok(root.querySelector(`.${className}`), `expected ${className}`);
  }
  // The generic names the contract used to emit are gone, not merely shadowed.
  assert.equal(root.querySelector(".mdy-description"), null);
  assert.equal(root.querySelector(".mdy-error"), null);

  mounted.dispose();
  host.remove();
});

/* ── The placement, reflected ─────────────────────────────────────────────────────────────────
 * The coordinates put a popup somewhere; only a class tells a stylesheet which side it landed on.
 * The catalog declares `above`/`overlay` as states of every popup part, and these assert the
 * renderer reflects them under exactly that name — the drift that produced `mdy-overlay-panel--above`
 * in two adapters, matched by no stylesheet, is precisely what this catches.
 */
const { positionOverlay, releaseOverlayPlacement } = await import("../dist/overlay.js");
const { overlayAnchoringFor, partClasses } = await import("../../widgets/dist/index.js");

/** A popup anchored by a control at `rect`, in an 800px-tall viewport. */
function placeAgainst(kind, rect) {
  const popup = document.createElement("div");
  popup.className = partClasses(kind, "popup").join(" ");
  const anchor = document.createElement("div");
  anchor.getBoundingClientRect = () => ({ ...rect, width: rect.right - rect.left });
  document.body.append(anchor, popup);
  positionOverlay(popup, anchor, overlayAnchoringFor(kind));
  return popup;
}

test("a popup opening upwards wears the contract's --above state, and loses it when it closes", () => {
  Object.defineProperty(document.documentElement, "clientHeight", { value: 800, configurable: true });
  Object.defineProperty(document.documentElement, "clientWidth", { value: 1000, configurable: true });

  const popup = placeAgainst("multiselect", { top: 700, bottom: 740, left: 100, right: 400 });
  const above = partClasses("multiselect", "popup", { above: true }).find((c) => c.endsWith("--above"));

  assert.equal(popup.dataset.placement, "above");
  assert.ok(popup.classList.contains(above), `expected ${above} on a popup that opened upwards`);

  releaseOverlayPlacement(popup);
  assert.equal(popup.classList.contains(above), false, "a closed popup is not sitting above anything");
});

test("a popup opening downwards carries no placement state — below is the ordinary case", () => {
  Object.defineProperty(document.documentElement, "clientHeight", { value: 800, configurable: true });
  Object.defineProperty(document.documentElement, "clientWidth", { value: 1000, configurable: true });

  const popup = placeAgainst("select", { top: 100, bottom: 140, left: 100, right: 400 });
  assert.equal(popup.dataset.placement, "below");
  assert.equal(
    popup.className.includes("--above") || popup.className.includes("--overlay"),
    false,
    "below must be spelled exactly like a popup nobody has placed",
  );
});
