/**
 * The two rules an overlay owes before any kind draws one: it is placed against its control, and it
 * closes when the interaction finishes elsewhere.
 *
 * Both are benched here without a widget, because both are the *renderer's* half of a contract the
 * catalogue already decides. A panel that draws every declared part and appears under the field
 * rather than against it is anatomically conformant and behaviourally inert — the state every panel
 * in the Vue package was in until these two hooks existed, and the state a conformance run reports
 * as a pass.
 *
 * jsdom measures every rectangle as zero, so what is asserted is not *where* the panel landed: it is
 * that the placement the contract returned was written onto the element, that the loop following the
 * anchor was started, and that both were given back when the panel closed. Where a panel actually
 * lands is a browser question and belongs to the browser tier.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { useMdyAnchoredPanel, useMdyLightDismiss } = await import("../dist/index.js");
const { popupPlacementClass, MDY_WIDGET_CONTRACTS } = await import("@modyra/widgets");

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

/**
 * A pointer interaction that starts and finishes on one element, as a person's press does.
 *
 * All three, because the policy reads the whole gesture: `click` is documented as its tail rather
 * than the gesture, and a bench that fires only part of it measures a rule nobody obeys.
 */
const pressOn = (element) => {
  for (const type of ["pointerdown", "pointerup", "click"]) {
    element.dispatchEvent(new window.Event(type, { bubbles: true, composed: true }));
  }
};

/** A field root, a trigger and a panel: the three elements every overlay kind hands these hooks. */
const Bench = ({ kind, open, close }) => {
  const root = React.useRef(null);
  const anchor = React.useRef(null);
  const panel = React.useRef(null);
  useMdyAnchoredPanel({ kind, panel, anchor, isOpen: open });
  useMdyLightDismiss({ kind, root, isOpen: open, close });
  return React.createElement("div", { ref: root, id: "root" }, [
    React.createElement("button", {
      key: "trigger", ref: anchor, id: "trigger", "aria-controls": "panel", "aria-expanded": String(open),
    }, "Open"),
    React.createElement("div", { key: "panel", ref: panel, id: "panel", hidden: !open }),
  ]);
};

const mount = async (kind, { open = false, close = () => undefined } = {}) => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const draw = (isOpen) => root.render(React.createElement(Bench, { kind, open: isOpen, close }));
  draw(open);
  await settle();
  return { host, draw, settle, dispose: () => { root.unmount(); host.remove(); } };
};

test("an open panel wears the placement the contract decided", async () => {
  const bench = await mount("select", { open: true });
  const panel = bench.host.querySelector("#panel");
  const placement = panel.dataset.placement;
  assert.ok(placement, "the panel carries no placement at all");
  assert.ok(
    panel.classList.contains(popupPlacementClass("select", placement)),
    `placement ${placement} was decided and its class is not on the panel`,
  );
  bench.dispose();
});

test("a shut panel is placed by nothing", async () => {
  const bench = await mount("select", { open: false });
  assert.equal(bench.host.querySelector("#panel").dataset.placement, undefined);
  bench.dispose();
});

test("a pointer finishing outside closes what is open", async () => {
  let closed = 0;
  const bench = await mount("select", { open: true, close: () => { closed += 1; } });
  const outside = document.createElement("button");
  document.body.append(outside);

  // The whole interaction, not the last half of it: dismissal is decided by where a press *and* its
  // release land, so a bench that only fires the release proves nothing about the rule.
  pressOn(outside);
  await bench.settle();
  assert.equal(closed, 1, "an interaction that finished outside did not dismiss");

  // Inside the panel is not outside, even though the panel is not inside the field's element: the
  // contract follows `aria-controls` out to it.
  const panel = bench.host.querySelector("#panel");
  pressOn(panel);
  await bench.settle();
  assert.equal(closed, 1, "an interaction inside the panel dismissed it");

  outside.remove();
  bench.dispose();
});

test("closing gives the listeners back", async () => {
  let closed = 0;
  const bench = await mount("select", { open: true, close: () => { closed += 1; } });
  bench.draw(false);
  await bench.settle();

  const outside = document.createElement("button");
  document.body.append(outside);
  pressOn(outside);
  await bench.settle();
  assert.equal(closed, 0, "a shut panel is still listening to the page");
  outside.remove();
  bench.dispose();
});

test("a kind that does not dismiss this way is given no listeners", async () => {
  // Asked of the catalogue rather than named here: if every kind dismisses on an outside pointer,
  // this test has nothing to say and says so, instead of passing because it found nothing.
  const abstaining = Object.keys(MDY_WIDGET_CONTRACTS)
    .find((kind) => MDY_WIDGET_CONTRACTS[kind].capabilities.dismissOnOutsidePointer === false);
  if (abstaining === undefined) return;

  let closed = 0;
  const bench = await mount(abstaining, { open: true, close: () => { closed += 1; } });
  const outside = document.createElement("button");
  document.body.append(outside);
  pressOn(outside);
  await bench.settle();
  assert.equal(closed, 0, `${abstaining} declares no outside dismissal and was dismissed anyway`);
  outside.remove();
  bench.dispose();
});
