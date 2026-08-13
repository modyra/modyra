/**
 * What the contract can promise a server, proved in a process that has no DOM.
 *
 * The environment is the whole point of this file. Every other suite in this package runs beside
 * one that installs jsdom, and a DOM installed for a neighbour would make every assertion here
 * pass without meaning anything — so the absence of a DOM is asserted first, and loudly. Node's
 * test runner gives each file its own process, which is what keeps that true.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

const {
  MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS, browserRuntimeCapabilities, createCatalogWidgetController,
  dynamicParts, isFullyServerRenderable, ssrRuntimeCapabilities, staticParts,
  defaultWidgetIdFactory, textFieldPartIds, projectTextFieldA11y, processWidgetCommands,
} = await import("../dist/index.js");

test("this process has no DOM, or nothing below proves anything", () => {
  // `navigator` is deliberately not in this list: Node defines one, so it says nothing about
  // whether a DOM is present and asserting on it would fail this suite for the wrong reason. It is
  // also why no package here may feature-detect a browser through it.
  for (const global of ["document", "window", "HTMLElement"]) {
    assert.equal(typeof globalThis[global], "undefined", `${global} is defined — a DOM leaked into the SSR suite`);
  }
});

test("the capability report probes the environment instead of asserting a browser", () => {
  // The controller consults this to decide whether a command can be executed. Reporting a DOM
  // where there is none tells it to focus something that does not exist.
  assert.deepEqual(browserRuntimeCapabilities(), ssrRuntimeCapabilities);
  assert.equal(browserRuntimeCapabilities().dom, false);
  assert.equal(browserRuntimeCapabilities().hydrated, false);

  // The one dimension no global can answer stays answerable by the caller — and cannot claim
  // hydration where there is not even a document.
  assert.equal(browserRuntimeCapabilities({ hydrated: true }).hydrated, false);
});

test("every kind produces its whole view contract with no DOM", () => {
  for (const kind of MDY_WIDGET_KINDS) {
    const controller = createCatalogWidgetController(kind);
    const view = controller.view();

    assert.ok(view.root, `${kind}: no root`);
    assert.ok(Object.keys(view.parts).length > 0, `${kind}: no parts`);
    for (const [name, part] of Object.entries(view.parts)) {
      assert.ok(Array.isArray(part.classes), `${kind}.${name}: classes are not an array`);
      assert.equal(typeof part.attributes, "object", `${kind}.${name}: no attributes`);
    }
    controller.destroy();
  }
});

test("ids are computable and deterministic with no DOM", () => {
  // `ids.ts` states that the same input must produce the same output on server and client. That is
  // the whole precondition for hydration: markup a server emitted must carry the ids the client
  // will look for.
  assert.equal(defaultWidgetIdFactory.part("email", "label"), "email__label");
  assert.equal(defaultWidgetIdFactory.item("pick", "option", "a"), "pick__option__a");
  assert.deepEqual(textFieldPartIds("email"), textFieldPartIds("email"));

  const projected = projectTextFieldA11y(
    { disabled: false, readonly: false, required: true, touched: false, open: false },
    [],
    { widgetId: "email" },
  );
  assert.equal(projected.label.attributes.for, "email");
  assert.equal(projected.input.attributes["aria-describedby"], "email__description");
});

test("every kind has a static half, and only overlay kinds have a dynamic one", () => {
  for (const kind of MDY_WIDGET_KINDS) {
    const staticHalf = staticParts(kind);
    const dynamicHalf = dynamicParts(kind);

    assert.ok(staticHalf.length > 0, `${kind}: nothing a server could emit`);
    assert.deepEqual(
      staticHalf.filter((part) => dynamicHalf.includes(part)),
      [],
      `${kind}: a part is both static and dynamic`,
    );

    // The two declarations must agree. A kind whose anatomy holds a popup but whose capabilities
    // deny an overlay is a contract defect, not a rendering one, and it would surface as a server
    // emitting markup no client knows how to open.
    assert.equal(
      isFullyServerRenderable(kind),
      !MDY_WIDGET_CONTRACTS[kind].capabilities.overlay,
      `${kind}: anatomy and capabilities.overlay disagree about the overlay`,
    );
  }
});

test("the split covers the anatomy exactly", () => {
  for (const kind of MDY_WIDGET_KINDS) {
    const declared = MDY_WIDGET_CONTRACTS[kind].structure.nodes.map((node) => node.part).sort();
    const split = [...staticParts(kind), ...dynamicParts(kind)].sort();
    // A part in neither half is a part no renderer is told when to emit.
    assert.deepEqual(split, declared, `${kind}: the split loses or duplicates a part`);
  }
});

test("the derivation does not depend on the order the anatomy is listed in", async () => {
  const { dynamicPartsOf } = await import("../dist/ssr.js");

  // Every catalogue anatomy happens to list a parent before its children, so a derivation that
  // walked the list once would agree with this one on all seventeen kinds and be wrong on the
  // first anatomy that did not. Reversing the list is the cheapest way to say so.
  for (const kind of MDY_WIDGET_KINDS) {
    const nodes = MDY_WIDGET_CONTRACTS[kind].structure.nodes;
    assert.deepEqual(
      [...dynamicPartsOf([...nodes].reverse())].sort(),
      [...dynamicParts(kind)].sort(),
      `${kind}: the split changes when the anatomy is listed in another order`,
    );
  }

  // And a synthetic three-deep chain listed child-first, which no catalogue entry currently is.
  const inverted = [
    { part: "cell", element: "gridcell", parent: "grid", order: 2 },
    { part: "grid", element: "grid", parent: "sheet", order: 1 },
    { part: "sheet", element: "popup", parent: "root", order: 0 },
    { part: "root", element: "root", order: 0 },
  ];
  assert.deepEqual([...dynamicPartsOf(inverted)].sort(), ["cell", "grid", "sheet"]);
});

test("a dynamic part is inside the popup, transitively", () => {
  // The subtree walk is the only non-obvious part of the derivation: a gridcell's parent is a grid
  // whose parent is the popup, so a single pass over the flat node list would miss it.
  const kinds = MDY_WIDGET_KINDS.filter((kind) => !isFullyServerRenderable(kind));
  assert.ok(kinds.length > 0, "no kind has an overlay — the derivation is proving nothing");

  for (const kind of kinds) {
    const nodes = MDY_WIDGET_CONTRACTS[kind].structure;
    const byPart = new Map(nodes.nodes.map((node) => [node.part, node]));
    const popups = new Set(nodes.nodes.filter((node) => node.element === "popup").map((node) => node.part));

    for (const part of dynamicParts(kind)) {
      let cursor = byPart.get(part);
      let depth = 0;
      while (cursor && !popups.has(cursor.part) && depth++ < 20) cursor = byPart.get(cursor.parent);
      assert.ok(cursor && popups.has(cursor.part), `${kind}.${part}: called dynamic but not under a popup`);
    }
  }
});

/**
 * The capability report has a consumer, so it can be wrong in a way something notices.
 *
 * It was declared, corrected once for reporting a browser from a bare Node process, and consumed by
 * nothing — so the correction was unfalsifiable and the header's claim that a controller used it to
 * suppress impossible commands described behaviour that existed nowhere.
 */
test("with no DOM, the commands that need one are not executed", () => {
  const done = [];
  const context = {
    lookup: () => ({ tagName: "INPUT" }),
    handlers: {
      setOpen: (open) => done.push(`setOpen:${open}`),
      onChange: () => done.push("change"),
      onTouched: () => done.push("touched"),
    },
    scheduleFocus: () => done.push("focus"),
    scheduleScroll: () => done.push("scroll"),
    announce: (m) => done.push(`announce:${m}`),
    capabilities: ssrRuntimeCapabilities,
  };
  processWidgetCommands([
    { type: "focus", target: { part: "control" } },
    { type: "restore-focus", target: { part: "trigger" } },
    { type: "scroll-into-view", target: { part: "option", key: "a" } },
    { type: "announce", message: "two results" },
    { type: "open-overlay", anchor: { part: "trigger" } },
    { type: "emit-change" },
    { type: "mark-touched" },
  ], context);

  // The state the controller is reporting still happens: it means the same thing on a server.
  assert.deepEqual(done, ["setOpen:true", "change", "touched"]);
});

test("with a DOM, every command still runs", () => {
  const done = [];
  const context = {
    lookup: () => ({ tagName: "INPUT" }),
    handlers: { setOpen: (open) => done.push(`setOpen:${open}`) },
    scheduleFocus: () => done.push("focus"),
    scheduleScroll: () => done.push("scroll"),
    announce: () => done.push("announce"),
    capabilities: { ...ssrRuntimeCapabilities, dom: true },
  };
  processWidgetCommands([
    { type: "focus", target: { part: "control" } },
    { type: "scroll-into-view", target: { part: "option" } },
    { type: "announce", message: "x" },
    { type: "close-overlay" },
  ], context);
  assert.deepEqual(done, ["focus", "scroll", "announce", "setOpen:false"]);
});

test("a context that says nothing about its runtime behaves as it always did", () => {
  const done = [];
  processWidgetCommands([{ type: "focus", target: { part: "control" } }], {
    lookup: () => ({ tagName: "INPUT" }),
    handlers: { setOpen: () => {} },
    scheduleFocus: () => done.push("focus"),
    scheduleScroll: () => {},
    announce: () => {},
  });
  assert.deepEqual(done, ["focus"], "omitting capabilities must not change behaviour");
});
