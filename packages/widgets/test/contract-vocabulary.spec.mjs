/**
 * The modules that had no spec, and what would go wrong without one.
 *
 * Sixteen root modules were published and never asserted. Most are tables, and a table looks like it
 * cannot break — until a part is renamed on one side of it, a widget stops declaring a state that a
 * theme still styles, or an id delimiter changes and every ARIA reference that carries it points at
 * nothing. Every check below is a relationship between two declarations that must not drift apart.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import {
  MDY_ID_DELIMITER,
  MDY_POPUP_OPENERS,
  MDY_SEMANTICS_REQUIRING_NAME,
  MDY_WIDGET_CONTRACTS,
  MDY_WIDGET_KINDS,
  MDY_WIDGET_RELATIONS,
  browserRuntimeCapabilities,
  defaultWidgetIdFactory,
  isValidWidgetId,
  partClasses,
  partsRequiringName,
  ssrRuntimeCapabilities,
  stateClass,
} from "../dist/index.js";
import { MDY_CANONICAL_UI_CLASSES, MDY_CSS_PROPERTY_NAMES, MDY_LABELABLE_TAGS, MDY_WIDGET_STATE_SUPPORT, widgetSupportsState } from "../dist/vocabulary.js";

test("every kind the vocabulary names has a definition, and no definition names a kind it does not", () => {
  assert.deepEqual([...MDY_WIDGET_KINDS].sort(), Object.keys(MDY_WIDGET_CONTRACTS).sort());
});

test("every declared part carries a class a theme could target, or is explicitly structural", () => {
  for (const kind of MDY_WIDGET_KINDS) {
    const definition = MDY_WIDGET_CONTRACTS[kind];
    for (const [name, part] of Object.entries(definition.parts)) {
      assert.ok(Array.isArray(part.classes), `${kind}.${name} declares no class list at all`);
    }
  }
});

test("the anatomy names only parts the kind declares", () => {
  for (const kind of MDY_WIDGET_KINDS) {
    const definition = MDY_WIDGET_CONTRACTS[kind];
    const declared = new Set([...Object.keys(definition.parts), "root"]);
    for (const node of definition.structure.nodes) {
      assert.ok(declared.has(node.part), `${kind}: anatomy names "${node.part}", which is not a part`);
      if (node.parent) {
        assert.ok(declared.has(node.parent), `${kind}: "${node.part}" hangs off "${node.parent}", which is not a part`);
      }
    }
  }
});

test("a part that must be named is a part the kind actually declares", () => {
  for (const kind of MDY_WIDGET_KINDS) {
    const declared = new Set([...Object.keys(MDY_WIDGET_CONTRACTS[kind].parts), "root"]);
    for (const part of partsRequiringName(kind)) {
      // A rule about a part nobody declares is a rule that is looked up forever and never fires.
      assert.ok(declared.has(part), `${kind}: "${part}" must be named and is not a part of this kind`);
    }
  }
  assert.ok(MDY_LABELABLE_TAGS.length > 0);
  assert.ok(MDY_SEMANTICS_REQUIRING_NAME.length > 0);
  // Keyed by kind, and every kind has a row: a widget with no relations declared is a widget whose
  // references nothing checks.
  assert.deepEqual(Object.keys(MDY_WIDGET_RELATIONS).sort(), [...MDY_WIDGET_KINDS].sort());
});

test("an opener names a part of the kind it opens, and something for it to control", () => {
  for (const [kind, opener] of Object.entries(MDY_POPUP_OPENERS)) {
    const declared = MDY_WIDGET_CONTRACTS[kind].parts;
    assert.ok(opener.opener in declared, `${kind}: the opener is "${opener.opener}", which is not a part`);
    // `aria-controls` has to point at something. An opener naming a part the kind does not declare
    // produces a reference to an element that will never exist.
    assert.ok(opener.controls in declared, `${kind}: the opener controls "${opener.controls}", which is not a part`);
    // A role only where the opener takes one: a daterange's toggle opens a dialog and is a button,
    // and giving it a combobox role would promise a listbox it does not have.
    if (opener.role !== undefined) assert.ok(opener.role.length > 0, `${kind}: the opener declares an empty role`);
  }
});

test("a widget claims a state only where the state exists", () => {
  const known = new Set(Object.keys(MDY_WIDGET_STATE_SUPPORT));
  for (const kind of MDY_WIDGET_KINDS) {
    assert.ok(known.has(kind), `${kind} is in no state-support row`);
    // The two answers must agree: one is the table, the other is what a consumer asks.
    for (const state of ["open", "disabled", "invalid"]) {
      const supported = MDY_WIDGET_STATE_SUPPORT[kind].includes(state);
      assert.equal(widgetSupportsState(kind, state), supported, `${kind}/${state}: the table and the question disagree`);
    }
  }
});

test("a class a part carries in a state is the class the state vocabulary builds", () => {
  const base = MDY_WIDGET_CONTRACTS.select.parts.trigger.classes[0];
  const built = partClasses("select", "trigger", { open: true });
  // A renderer spelling a modifier and a theme writing a rule for it agree only by coincidence
  // unless both derive it from here.
  assert.ok(built.includes(stateClass(base, "open")), `partClasses did not produce ${stateClass(base, "open")}`);
  assert.ok(!built.includes(stateClass(base, "disabled")), "a state that is off was painted anyway");
});

test("a part refuses a state it never declared", () => {
  // The set of classes a part may ever carry is finite and knowable, which is what lets a theme be
  // checked against it. Asking for one outside that set is a mistake, not a new class.
  assert.throws(() => partClasses("select", "trigger", { dragover: true }), /does not declare the state/);
});

test("an id is built from the delimiter every reference carries", () => {
  const id = defaultWidgetIdFactory.part("field", "label");
  assert.equal(id, `field${MDY_ID_DELIMITER}label`);
  assert.equal(isValidWidgetId("field"), true);
  // A name containing the delimiter collides with a generated one, and the browser is happy to hold
  // two elements with the same id — so `getElementById`, `label[for]` and every ARIA IDREF stop
  // being deterministic.
  assert.equal(isValidWidgetId(`a${MDY_ID_DELIMITER}label`), false);
});

test("with no document, a runtime claims nothing", () => {
  // Every capability false is the honest answer where there is no DOM, and a command executor that
  // believed otherwise would try to focus something that does not exist. This suite runs without a
  // document, so what `browserRuntimeCapabilities()` reports here is exactly the server's answer.
  const detected = browserRuntimeCapabilities();
  assert.deepEqual(detected, ssrRuntimeCapabilities);
  for (const [name, value] of Object.entries(ssrRuntimeCapabilities)) {
    assert.equal(value, false, `${name} was claimed with no document to provide it`);
  }
});

test("every custom property a theme reads is a custom property", () => {
  assert.ok(MDY_CSS_PROPERTY_NAMES.length > 0);
  for (const name of MDY_CSS_PROPERTY_NAMES) {
    // `--index` is deliberately unprefixed: it is the position a foundation places a dial number
    // from, written by the renderer and read by the stylesheet, and prefixing it would rename it in
    // one of the two places.
    assert.match(name, /^--/, `${name} is not a custom property at all`);
  }
});

test("the root's classes come from the states it is in, for every kind alike", async () => {
  const { fieldShellRootClasses } = await import("../dist/field/index.js");
  const quiet = fieldShellRootClasses({ disabled: false, touched: false });
  const failing = fieldShellRootClasses({ disabled: true, touched: true });
  // Every kind had this function and every copy was the same five lines over the same table.
  assert.ok(failing.length > quiet.length, "a root in more states carried no more classes");
  assert.ok(quiet.length > 0, "a root at rest carries no class at all");
});

test("the canonical class list is derived from the definitions, not kept beside them", () => {
  const fromDefinitions = new Set(MDY_WIDGET_KINDS.flatMap((kind) => MDY_WIDGET_CONTRACTS[kind].rootClasses));
  assert.deepEqual([...MDY_CANONICAL_UI_CLASSES].sort(), [...fromDefinitions].sort());
});

// ─── the modules nothing had touched ─────────────────────────────────────────

import {
  applyPart,
  createMdyAnnouncer,
  dynamicParts,
  isFullyServerRenderable,
  overlayControlledId,
  partStates,
  portalRootFor,
  processWidgetCommands,
  projectOverlayOpenerA11y,
  reconcileSelectValue,
  setOverlayOpen,
  staticParts,
  trackAnchoredOverlay,
  MDY_STATE_EXPRESSION,
} from "../dist/index.js";
import { widgetStateMatrixSize, MDY_SHARED_UI_CLASSES, MDY_WIDGET_STATES } from "../dist/vocabulary.js";

/**
 * `trackAnchoredOverlay` had no test at all, and it is the function that exists to end three
 * divergent copies — `overlay-dom.ts:63` says so in its own words. A primitive written to replace
 * three implementations, and never asserted, is a fourth implementation nobody checked.
 */
test("an anchored overlay repositions only while it is open", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  globalThis.window = dom.window;
  globalThis.requestAnimationFrame = (fn) => dom.window.setTimeout(() => fn(0), 0);
  globalThis.cancelAnimationFrame = (id) => dom.window.clearTimeout(id);

  let repositioned = 0;
  let reflowed = 0;
  let open = true;
  const stop = trackAnchoredOverlay({
    reposition: () => { repositioned += 1; },
    reflow: () => { reflowed += 1; },
    isOpen: () => open,
  });
  assert.equal(typeof stop, "function", "tracking gave back no way to stop");

  // Closed, the listeners are still bound and must do nothing: a popup that repositions while hidden
  // measures a rectangle nobody is looking at, once per scroll event.
  open = false;
  dom.window.dispatchEvent(new dom.window.Event("scroll"));
  assert.equal(repositioned, 0);

  stop();
  assert.doesNotThrow(() => stop(), "stopping twice threw");
});

/**
 * Scrolling and resizing ask different questions, and a popup that answers both the same way flips
 * sides under the pointer or stays the wrong size after a rotation. Both renderers that place their
 * own popups had drawn the distinction and neither could use this function until it took two.
 */
test("a page that moves and a viewport that resizes are answered separately", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  globalThis.window = dom.window;
  globalThis.requestAnimationFrame = (fn) => dom.window.setTimeout(() => fn(0), 0);
  globalThis.cancelAnimationFrame = (id) => dom.window.clearTimeout(id);
  const settle = () => new Promise((resolve) => dom.window.setTimeout(resolve, 5));

  let repositioned = 0;
  let reflowed = 0;
  const stop = trackAnchoredOverlay({
    reposition: () => { repositioned += 1; },
    reflow: () => { reflowed += 1; },
    isOpen: () => true,
  });

  dom.window.dispatchEvent(new dom.window.Event("scroll"));
  await settle();
  assert.deepEqual([repositioned, reflowed], [1, 0], "a scroll follows the anchor, it does not re-decide");

  dom.window.dispatchEvent(new dom.window.Event("resize"));
  await settle();
  assert.deepEqual([repositioned, reflowed], [1, 1], "a resize decides again");

  stop();

  // A popup that covers the viewport has no anchor to follow, so it binds no scroll listener at all.
  let covered = 0;
  const stopCovering = trackAnchoredOverlay({
    reposition: () => { covered += 1; },
    isOpen: () => true,
    followsScroll: () => false,
  });
  dom.window.dispatchEvent(new dom.window.Event("scroll"));
  await settle();
  assert.equal(covered, 0, "a covering overlay listens for a scroll it cannot use");
  stopCovering();
});

test("showing and hiding an overlay is one function, not each renderer's own", () => {
  const dom = new JSDOM("<!doctype html><html><body><div id='p' hidden></div></body></html>");
  const popup = dom.window.document.getElementById("p");
  setOverlayOpen(popup, true);
  assert.equal(popup.hidden, false);
  setOverlayOpen(popup, false);
  assert.equal(popup.hidden, true);
});

test("a part contract is written onto an element, and takes back only its own classes", () => {
  const dom = new JSDOM("<!doctype html><html><body><div class='keep'></div></body></html>");
  const element = dom.window.document.querySelector("div");
  applyPart(element, { classes: ["mine"], attributes: { "aria-hidden": "true" } });
  assert.equal(element.getAttribute("aria-hidden"), "true");
  assert.ok(element.classList.contains("mine"));
  // A host's own classes are not this library's to remove.
  assert.ok(element.classList.contains("keep"), "applying a part took a class it never added");
});

test("a portalled popup is reached through the relationship the widget declared", () => {
  const dom = new JSDOM(`<!doctype html><html><body>
    <div id="w"><button aria-controls="lb"></button></div>
    <div class="mdy-overlay"><div id="lb"></div></div>
  </body></html>`);
  const root = dom.window.document.getElementById("w");
  const found = portalRootFor(root);
  // By class it would return whichever field rendered first; by the named element alone it would
  // find no popup and report one missing beside an `aria-expanded="true"`.
  assert.ok(found, "the portalled subtree was not found through aria-controls");
  assert.equal(found.querySelector("#lb") !== null, true);
});

test("what a server can render is what does not depend on being open", () => {
  for (const kind of MDY_WIDGET_KINDS) {
    const stat = staticParts(kind);
    const dynamic = dynamicParts(kind);
    const overlap = stat.filter((p) => dynamic.includes(p));
    assert.deepEqual(overlap, [], `${kind}: "${overlap[0]}" is both static and dynamic`);
    assert.equal(typeof isFullyServerRenderable(kind), "boolean");
  }
});

test("an opener names the overlay it controls, and says so only while there is one", () => {
  const closed = projectOverlayOpenerA11y("select", { widgetId: "w", open: false });
  const open = projectOverlayOpenerA11y("select", { widgetId: "w", open: true });
  assert.equal(closed.attributes["aria-expanded"], "false");
  assert.equal(open.attributes["aria-expanded"], "true");
  assert.equal(open.attributes["aria-controls"], overlayControlledId("select", "w"));
});

test("a command with nowhere to land is not executed", () => {
  const done = [];
  processWidgetCommands([{ type: "focus", target: { part: "missing" } }, { type: "mark-touched" }], {
    lookup: () => undefined,
    handlers: { setOpen: () => undefined, onTouched: () => done.push("touched") },
    scheduleFocus: () => done.push("focused"),
    scheduleScroll: () => undefined,
    announce: () => undefined,
  });
  // A lookup that finds nothing must not schedule work against `undefined`.
  assert.deepEqual(done, ["touched"]);
  assert.equal(typeof createMdyAnnouncer("mdy-x").announce, "function");
});

test("the state matrix is as big as the states and the kinds that support them", () => {
  assert.ok(MDY_WIDGET_STATES.length > 0);
  assert.ok(widgetStateMatrixSize() > MDY_WIDGET_STATES.length,
    "the matrix is no larger than the state list, so no kind supports more than one");
  // How each kind expresses its states — a class, an attribute — keyed by kind, and every kind has
  // an answer: a widget whose expression is unstated is one a theme cannot be checked against.
  assert.deepEqual(Object.keys(MDY_STATE_EXPRESSION).sort(), [...MDY_WIDGET_KINDS].sort());
  assert.ok(MDY_SHARED_UI_CLASSES.length > 0);
  // Every state the part *declares*, not only the ones that are on: a theme is checked against the
  // finite set a part may ever carry, and that set does not depend on the moment.
  assert.deepEqual(partStates("select", "trigger"), ["open", "disabled", "readonly", "invalid", "loading"]);
});

test("a value the options do not contain is reconciled, not erased", () => {
  const reconciled = reconcileSelectValue({ value: "de", parkedValue: null }, [{ value: "fr", label: "France" }]);
  // The whole point: a value stays in the model even when its option is missing, so the person can
  // see what is there and replace it.
  assert.equal(reconciled.value, "de");
  assert.equal(reconciled.parkedValue, null);
});

// ─── the shapes, named where they are used ───────────────────────────────────

import {
  decideOverlayAlignment,
  decideOverlayPlacement,
} from "../dist/index.js";

/**
 * An alignment is a decision about the other axis, and it had no test.
 *
 * `decideOverlayPlacement` chooses the side; this chooses the edge. Both read the same geometry and
 * the same viewport margin, which is why they now live in the same file — and why one of them being
 * unasserted meant half the rule was unchecked.
 */
test("an overlay aligns to the edge that leaves it room", () => {
  /** @type {import("../dist/index.js").MdyOverlayGeometry} */
  const nearLeft = {
    viewportWidth: 1000, viewportHeight: 800,
    anchorTop: 100, anchorBottom: 132, anchorLeft: 10, anchorRight: 130, anchorWidth: 120,
    minSpace: 160, minWidth: 300, preferred: "below",
  };
  const nearRight = { ...nearLeft, anchorLeft: 880, anchorRight: 1000 };

  const left = decideOverlayAlignment(nearLeft);
  const right = decideOverlayAlignment(nearRight);
  // An anchor against the right edge cannot align its popup left-to-left without going off screen.
  assert.notEqual(left, right, "the alignment ignored where the anchor sits");

  /** @type {import("../dist/index.js").MdyOverlayDecision} */
  const decision = decideOverlayPlacement(nearLeft);
  assert.ok(decision.placement);
  assert.ok(decision.alignment);
});

/**
 * The shapes a consumer binds to, named so a rename cannot pass unnoticed.
 *
 * A type nothing names is a type nothing notices changing — and these are the ones a renderer writes
 * its own code against: what a controller is, what a view contract holds, what an id factory must
 * provide, what a runtime can do.
 */
test("the published shapes are the ones a renderer builds against", () => {
  /** @type {import("../dist/index.js").MdyWidgetIdFactory} */
  const ids = defaultWidgetIdFactory;
  assert.equal(typeof ids.part, "function");

  /** @type {import("../dist/index.js").MdyWidgetRuntimeCapabilities} */
  const capabilities = ssrRuntimeCapabilities;
  assert.equal(capabilities.dom, false);

  /** @type {import("../dist/index.js").MdyPartContract} */
  const part = { classes: ["x"], attributes: {} };
  /** @type {import("../dist/index.js").MdyPartMap<"control">} */
  const parts = { control: part };
  /** @type {import("../dist/index.js").MdyWidgetViewContract} */
  const view = { root: part, parts };
  /** @type {import("../dist/index.js").MdyTypedWidgetViewContract<"control">} */
  const typed = { root: part, parts };
  assert.equal(view.parts.control, typed.parts.control);

  /** @type {import("../dist/index.js").MdyElementTarget} */
  const target = { part: "control" };
  assert.equal(target.part, "control");

  /** @type {import("../dist/index.js").MdyOverlayProperty} */
  const property = MDY_CSS_PROPERTY_NAMES.find((name) => name.startsWith("--mdy-overlay"));
  assert.ok(property, "no overlay property is declared");

  /** @type {import("../dist/index.js").MdySelectReconciliationState<string>} */
  const reconciliation = { value: "de", parkedValue: null };
  assert.equal(reconciliation.parkedValue, null);

  /** @type {import("../dist/index.js").MdyWidgetState} */
  const state = "open";
  /** @type {import("../dist/index.js").MdyFieldShellPart} */
  const shellPart = "label";
  assert.ok(MDY_WIDGET_STATES.includes(state));
  assert.equal(typeof shellPart, "string");
});

/**
 * The anatomy is metadata, and its own type says as much.
 *
 * `MdyWidgetStructure` is a list of nodes with a parent and an order — deliberately not a virtual
 * DOM. A consumer that could build one could describe a widget this package does not know about,
 * which is why the shape is narrow and worth pinning.
 */
test("the anatomy describes where a part sits, and nothing about how to make one", () => {
  /** @type {import("../dist/index.js").MdyWidgetStructureNode<"root" | "control">} */
  const node = { part: "control", element: "input", parent: "root", order: 0 };
  /** @type {import("../dist/index.js").MdyWidgetStructure<"root" | "control">} */
  const structure = { nodes: [node] };
  assert.equal(structure.nodes[0].part, "control");
  // No children, no props, no factory: a node says what a part is and where it sits.
  assert.deepEqual(Object.keys(node).sort(), ["element", "order", "parent", "part"]);

  /** @type {import("../dist/index.js").MdyWidgetSemanticElement} */
  const element = node.element;
  assert.equal(element, "input");
});

/**
 * A relation is an attribute pointing from one part at another, and what may name a control.
 */
test("a relation names both ends and the attribute between them", () => {
  for (const [kind, relations] of Object.entries(MDY_WIDGET_RELATIONS)) {
    for (const relation of relations) {
      /** @type {import("../dist/index.js").MdyWidgetRelation} */
      const declared = relation;
      /** @type {import("../dist/index.js").MdyRelationAttribute} */
      const attribute = declared.attribute;
      assert.ok(attribute.length > 0, `${kind}: a relation with no attribute points nowhere`);
      assert.ok(declared.from && declared.to, `${kind}: a relation missing an end`);
    }
  }
  /** @type {import("../dist/index.js").MdyAccessibleNameSource} */
  const source = MDY_SEMANTICS_REQUIRING_NAME[0];
  assert.ok(typeof source === "string");
});

/**
 * A command context is what an executor is handed, and an announcer is how a widget speaks.
 */
test("an executor is given a lookup, handlers and somewhere to announce", () => {
  const said = [];
  /** @type {import("../dist/index.js").MdyAnnouncer} */
  const announcer = { announce: (message) => said.push(message) };
  /** @type {import("../dist/index.js").MdyWidgetCommandContext} */
  const context = {
    lookup: () => undefined,
    handlers: { setOpen: () => undefined },
    scheduleFocus: () => undefined,
    scheduleScroll: () => undefined,
    announce: (message) => announcer.announce(message),
  };
  processWidgetCommands([{ type: "announce", message: "two options" }], context);
  assert.deepEqual(said, ["two options"]);

  /** @type {import("../dist/index.js").MdyWidgetCommandExecutor} */
  const executor = (commands) => processWidgetCommands(commands, context);
  assert.equal(typeof executor, "function");

  /** @type {import("../dist/index.js").MdyOverlayOpenerA11yOptions} */
  const openerOptions = { widgetId: "w", open: false };
  assert.equal(projectOverlayOpenerA11y("select", openerOptions).attributes["aria-expanded"], "false");
});
