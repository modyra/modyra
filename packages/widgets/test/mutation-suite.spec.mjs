/**
 * The mutation suite: deliberately broken renderers, and the proof that each one is rejected.
 *
 * A conformance suite that only shows a correct renderer going green proves nothing — it cannot
 * distinguish a gate from a rubber stamp. Each mutation below takes a conforming fixture, breaks
 * exactly one thing, and asserts the inspector says so *and says where*.
 *
 * Mutations 1–15 are the acceptance checklist from the technical review, numbered here as they are
 * numbered there. 16–18 break what a widget *announces* rather than how it is shaped, and are judged
 * by the state inspector; a mutation earns its place here by being one a renderer could plausibly
 * ship, not by being one the inspector happens to catch.
 *
 * `EXPECTED_UNCAUGHT` is the ratchet. A mutation listed there is a known false green — the
 * inspector cannot see it yet — and the suite stays green so it can run on every build from today.
 * The suite fails in both directions: a mutation that should be caught and is not is a regression,
 * and a listed mutation that *starts* being caught is progress the list has to record. Milestone A
 * is done when this list is empty, and the length of the list is the metric.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import {
  idsUnder,
  inspectCoexistence,
  inspectUnmount,
  inspectWidgetDom,
  inspectWidgetState,
} from "../dist/testing/index.js";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const document = dom.window.document;

let fixtureSeq = 0;
/** Every element a fixture mounts, so one mutation's DOM cannot become another's duplicate id. */
const mounted = [];
function mount(element) {
  document.body.append(element);
  mounted.push(element);
  return element;
}
function clearMounted() {
  for (const element of mounted.splice(0)) element.remove();
}

function el(tag, className, attributes = {}) {
  const node = document.createElement(tag);
  if (className) node.setAttribute("class", className);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}

/* ── Conforming fixtures ──────────────────────────────────────────────────────
 * Each returns { root, parts }, mounted in the document so id lookups resolve. */

function textField({ id = `t${(fixtureSeq += 1)}` } = {}) {
  const root = el("div", "mdy-renderer mdy-renderer--text");
  const label = el("label", "mdy-label", { for: `${id}-control` });
  const marker = el("span", "mdy-label__required");
  label.append(marker);
  const wrapper = el("div", "mdy-input-wrapper");
  const control = el("input", null, { id: `${id}-control`, "aria-describedby": `${id}-errors` });
  wrapper.append(control);
  const supporting = el("p", "mdy-supporting-text");
  const errors = el("ul", "mdy-control__errors", { id: `${id}-errors` });
  const errorItem = el("li", "mdy-control__error");
  errors.append(errorItem);
  root.append(label, wrapper, supporting, errors);
  mount(root);
  return {
    root,
    parts: {
      label, requiredMarker: marker, inputWrapper: wrapper, control,
      supportingText: supporting, errors, errorItem,
    },
  };
}

function dateRange({ id = `d${(fixtureSeq += 1)}` } = {}) {
  const root = el("div", "mdy-renderer mdy-renderer--datepicker mdy-renderer--daterange");
  const label = el("label", "mdy-label", { for: `${id}-start` });
  const wrapper = el("div", "mdy-input-wrapper");
  const startControl = el("input", "mdy-datepicker__input mdy-daterange__input mdy-daterange__input--start", { id: `${id}-start` });
  const separator = el("span", "mdy-daterange__sep");
  const endControl = el("input", "mdy-datepicker__input mdy-daterange__input mdy-daterange__input--end", { id: `${id}-end` });
  const toggle = el("button", "mdy-datepicker__toggle", { "aria-controls": `${id}-popup`, "aria-expanded": "true" });
  wrapper.append(startControl, separator, endControl, toggle);
  const popup = el("div", "mdy-datepicker__popup mdy-popup mdy-popup--surface mdy-datepicker__popup--range", { id: `${id}-popup`, role: "dialog" });
  const calendar = el("div", "mdy-datepicker__calendar", { role: "group" });
  const grid = el("div", "mdy-datepicker__grid", { role: "grid", "aria-label": "Choose a date" });
  const row = el("div", "mdy-datepicker__row", { role: "row" });
  const gridcell = el("div", "mdy-datepicker__cell", { role: "gridcell" });
  row.append(gridcell);
  grid.append(row);
  calendar.append(grid);
  popup.append(calendar);
  root.append(label, wrapper, popup);
  mount(root);
  return {
    root,
    parts: {
      label, inputWrapper: wrapper, startControl, separator, endControl, toggle,
      popup, calendar, grid, row, gridcell,
    },
  };
}

function selectField({ id = `s${(fixtureSeq += 1)}`, optionCount = 3 } = {}) {
  const root = el("div", "mdy-renderer mdy-renderer--select");
  const label = el("label", "mdy-label", { for: `${id}-trigger` });
  const wrapper = el("div", "mdy-input-wrapper");
  const trigger = el("button", "mdy-select__trigger", {
    id: `${id}-trigger`, role: "combobox", "aria-controls": `${id}-popup`, "aria-expanded": "true",
  });
  const value = el("span", "mdy-select__value");
  const placeholder = el("span", "mdy-select__placeholder");
  const arrow = el("span", "mdy-select__arrow");
  trigger.append(value, placeholder, arrow);
  wrapper.append(trigger);
  const popup = el("div", "mdy-select__dropdown mdy-popup mdy-popup--surface", { id: `${id}-popup`, role: "dialog" });
  const listbox = el("div", "mdy-select__list", { role: "listbox", "aria-label": "Options" });
  const options = [];
  for (let i = 0; i < optionCount; i++) {
    const option = el("div", "mdy-select__option", { role: "option", id: `${id}-opt-${i}` });
    listbox.append(option);
    options.push(option);
  }
  popup.append(listbox);
  root.append(label, wrapper, popup);
  mount(root);
  return {
    root,
    parts: { label, inputWrapper: wrapper, trigger, value, popup, listbox, option: options },
  };
}

/**
 * A date range that is genuinely disabled: both controls announce it, and every native control
 * outside the popup carries the attribute that makes it true rather than merely claimed.
 */
function disabledDateRange() {
  const fx = dateRange();
  for (const part of ["startControl", "endControl", "toggle"]) fx.parts[part].setAttribute("disabled", "");
  fx.parts.startControl.setAttribute("aria-disabled", "true");
  fx.parts.endControl.setAttribute("aria-disabled", "true");
  return fx;
}

/* ── The mutations, as data ───────────────────────────────────────────────────
 * Each `mutate` breaks exactly one thing and returns what to inspect. Returning a
 * new `parts`/`kind` lets a mutation change what the adapter *claims*, which is how
 * several of these hide from an inspector that trusts the caller's part map. */

/**
 * A teardown that leaves something behind, built the way a renderer leaves it.
 *
 * These are judged by `inspectUnmount`/`inspectCoexistence` rather than by the DOM or state
 * inspectors, and until now nothing put those to the test: the nineteen mutations above all struck
 * the other two, while the blind spot found in the demo batch — an effect still subscribed after
 * teardown — lived precisely here. An inspector that has never rejected anything is a promise.
 */
const LIFECYCLE_MUTATIONS = [
  {
    n: "L1", id: "dom-survived", title: "a teardown that leaves its root in the document",
    // The rule this mutation breaks. Asserting only "something was reported" lets one rule
    // cover for another: a leftover element raises the DOM code too, and the id rule could stop
    // looking without a single test noticing.
    expect: "DOM_SURVIVED_UNMOUNT",
    run: () => {
      const before = document.body.querySelectorAll("*").length;
      const root = el("div", "mdy-renderer");
      root.append(el("span", "mdy-label"));
      mount(root);
      const ids = idsUnder(root);
      // The renderer "disposes" and removes nothing.
      return inspectUnmount({ document, idsWhileMounted: ids, elementsBeforeMount: before });
    },
  },
  {
    n: "L2", id: "id-survived", title: "a teardown that leaves an id resolvable",
    // The rule this mutation breaks. Asserting only "something was reported" lets one rule
    // cover for another: a leftover element raises the DOM code too, and the id rule could stop
    // looking without a single test noticing.
    expect: "ID_SURVIVED_UNMOUNT",
    run: () => {
      const before = document.body.querySelectorAll("*").length;
      const root = el("div", "mdy-renderer");
      const labelled = el("span", "mdy-label");
      labelled.id = "mdy-ghost-1";
      root.append(labelled);
      mount(root);
      const ids = idsUnder(root);
      // The root goes; a portalled element carrying the same id does not.
      root.remove();
      const ghost = el("div", null);
      ghost.id = "mdy-ghost-1";
      mount(ghost);
      return inspectUnmount({ document, idsWhileMounted: ids, elementsBeforeMount: before });
    },
  },
  {
    n: "L3", id: "effect-survived", title: "a disposed instance that still writes to the document",
    // The rule this mutation breaks. Asserting only "something was reported" lets one rule
    // cover for another: a leftover element raises the DOM code too, and the id rule could stop
    // looking without a single test noticing.
    expect: "REACTIVE_EFFECT_SURVIVED_UNMOUNT",
    run: () => {
      const before = document.body.querySelectorAll("*").length;
      const root = el("div", "mdy-renderer");
      mount(root);
      const ids = idsUnder(root);
      root.remove();
      return inspectUnmount({
        document,
        idsWhileMounted: ids,
        elementsBeforeMount: before,
        // The effect outlived its teardown and renders again into a document it no longer owns.
        pokeAfterDispose: () => mount(el("div", "mdy-renderer")),
      });
    },
  },
  {
    n: "L4", id: "effect-threw", title: "a disposed instance whose effect ran and failed",
    // The rule this mutation breaks. Asserting only "something was reported" lets one rule
    // cover for another: a leftover element raises the DOM code too, and the id rule could stop
    // looking without a single test noticing.
    expect: "EFFECT_THREW_AFTER_UNMOUNT",
    run: () => {
      const before = document.body.querySelectorAll("*").length;
      const root = el("div", "mdy-renderer");
      mount(root);
      const ids = idsUnder(root);
      root.remove();
      return inspectUnmount({
        document,
        idsWhileMounted: ids,
        elementsBeforeMount: before,
        pokeAfterDispose: () => undefined,
        // Nothing reaches the document, which is why the visible half reads this as clean.
        errorsAfterDispose: () => ["effect ran after its scope was destroyed"],
      });
    },
  },
  {
    n: "L5", id: "ids-collided", title: "two live instances minting the same id",
    // The rule this mutation breaks. Asserting only "something was reported" lets one rule
    // cover for another: a leftover element raises the DOM code too, and the id rule could stop
    // looking without a single test noticing.
    expect: "ID_COLLIDED_ACROSS_INSTANCES",
    run: () => inspectCoexistence(new Set(["mdy-text-1", "mdy-text-1__label"]), new Set(["mdy-text-1"])),
  },
];

const MUTATIONS = [
  {
    n: 1, id: "root-absent", title: "widget root absent",
    build: textField,
    mutate: (fx) => {
      // The adapter renders no root at all: the "root" handed to the inspector is a
      // bare div that never carried the contract's classes.
      const orphan = el("div", null);
      orphan.append(...fx.root.childNodes);
      mount(orphan);
      return { root: orphan, kind: "text", options: { parts: fx.parts } };
    },
  },
  {
    n: 2, id: "class-renamed", title: "canonical class renamed",
    build: textField,
    mutate: (fx) => {
      fx.parts.label.setAttribute("class", "mdy-label-text");
      return { root: fx.root, kind: "text", options: { parts: fx.parts } };
    },
  },
  {
    n: 3, id: "wrong-parent", title: "part placed under the wrong parent",
    build: textField,
    mutate: (fx) => {
      // requiredMarker belongs inside the label; here it is hoisted to the root.
      fx.root.append(fx.parts.requiredMarker);
      return { root: fx.root, kind: "text", options: { parts: fx.parts } };
    },
  },
  {
    n: 4, id: "range-second-control-missing", title: "date range's second control missing",
    build: dateRange,
    mutate: (fx) => {
      fx.parts.endControl.remove();
      const parts = { ...fx.parts };
      delete parts.endControl;
      return { root: fx.root, kind: "daterange", options: { parts } };
    },
  },
  {
    n: 5, id: "aria-controls-crosswired", title: "aria-controls pointing at another field's popup",
    build: selectField,
    mutate: (fx) => {
      const stranger = el("div", null, { id: "someone-elses-popup" });
      mount(stranger);
      fx.parts.trigger.setAttribute("aria-controls", "someone-elses-popup");
      return { root: fx.root, kind: "select", options: { parts: fx.parts } };
    },
  },
  {
    n: 6, id: "duplicate-id", title: "duplicate id",
    build: textField,
    mutate: (fx) => {
      const twin = el("input", null, { id: fx.parts.control.getAttribute("id") });
      fx.parts.inputWrapper.append(twin);
      return { root: fx.root, kind: "text", options: { parts: fx.parts } };
    },
  },
  {
    n: 7, id: "label-for-dangling", title: "label[for] pointing at a control that does not exist",
    build: textField,
    mutate: (fx) => {
      fx.parts.label.setAttribute("for", "no-such-control");
      return { root: fx.root, kind: "text", options: { parts: fx.parts } };
    },
  },
  {
    n: 8, id: "describedby-dangling", title: "aria-describedby pointing at an absent node",
    build: textField,
    mutate: (fx) => {
      fx.parts.control.setAttribute("aria-describedby", "no-such-node");
      return { root: fx.root, kind: "text", options: { parts: fx.parts } };
    },
  },
  {
    n: 9, id: "foreign-popup", title: "widget holding another instance's popup",
    build: selectField,
    mutate: (fx) => {
      const other = selectField({ id: "s2" });
      // This widget adopts the *other* widget's popup as its own.
      fx.root.append(other.parts.popup);
      const parts = { ...fx.parts, popup: other.parts.popup, options: other.parts.options, option: other.parts.option };
      return { root: fx.root, kind: "select", options: { parts } };
    },
  },
  {
    n: 10, id: "aria-only-disabled", title: "disabled expressed only through ARIA",
    build: textField,
    mutate: (fx) => {
      fx.parts.control.setAttribute("aria-disabled", "true");
      // and never `disabled` on the native control
      return { root: fx.root, kind: "text", options: { parts: fx.parts } };
    },
  },
  {
    n: 11, id: "wrong-cardinality", title: "wrong number of options, chips or cells",
    build: () => selectField({ optionCount: 3 }),
    mutate: (fx) => {
      // Two of the three options are dropped from the DOM but the adapter still
      // reports three parts — or reports the two it kept. Either way the count is a lie.
      fx.parts.option[1].remove();
      fx.parts.option[2].remove();
      const parts = { ...fx.parts, option: [fx.parts.option[0]] };
      // The state has three options. Only the caller can say so — the contract knows `option`
      // repeats, not how many times — so the count is declared and the DOM has to answer it.
      return { root: fx.root, kind: "select", options: { parts, counts: { option: 3 } } };
    },
  },
  {
    n: 12, id: "part-order", title: "parts in a non-conforming order",
    build: textField,
    mutate: (fx) => {
      // supportingText must follow inputWrapper; here it is moved before the label.
      fx.root.prepend(fx.parts.supportingText);
      return { root: fx.root, kind: "text", options: { parts: fx.parts } };
    },
  },
  {
    n: 15, id: "part-wrong-element", title: "part rendered as the wrong element",
    build: textField,
    mutate: (fx) => {
      // The label keeps its class, its text and its place — only the tag is wrong, so every check
      // that looks at classes or position still passes. A <div> cannot carry `for`, so a screen
      // reader loses the association while the markup looks right.
      const impostor = el("div", "mdy-label");
      impostor.append(...fx.parts.label.childNodes);
      fx.parts.label.replaceWith(impostor);
      return { root: fx.root, kind: "text", options: { parts: { ...fx.parts, label: impostor } } };
    },
  },
  {
    n: 13, id: "popup-open-but-absent", title: "popup declared open but absent",
    build: selectField,
    mutate: (fx) => {
      fx.parts.trigger.setAttribute("aria-expanded", "true");
      fx.parts.popup.remove();
      const parts = { ...fx.parts };
      delete parts.popup;
      delete parts.options;
      delete parts.option;
      return {
        root: fx.root, kind: "select",
        options: { parts, absentParts: ["popup", "listbox", "option"] },
      };
    },
  },
  {
    n: 14, id: "popup-present-when-unmounted", title: "popup present when the contract declares it unmounted",
    build: selectField,
    mutate: (fx) => {
      // Closed, by its own account — and the popup is still in the DOM.
      fx.parts.trigger.setAttribute("aria-expanded", "false");
      const parts = { ...fx.parts };
      delete parts.popup;
      delete parts.options;
      delete parts.option;
      return {
        root: fx.root, kind: "select",
        options: { parts, absentParts: ["popup", "listbox", "option"] },
      };
    },
  },
  {
    n: 16, id: "state-aria-on-root", title: "state announced on the root instead of its carrier",
    build: selectField, state: "open",
    mutate: (fx) => {
      // The widget still says `aria-expanded` — just nowhere a screen reader listening to the
      // combobox will hear it. Saying it somewhere is not saying it.
      fx.parts.trigger.removeAttribute("aria-expanded");
      fx.root.setAttribute("aria-expanded", "true");
      return { root: fx.root, kind: "select", state: "open", options: { parts: fx.parts, control: fx.parts.trigger } };
    },
  },
  {
    n: 17, id: "state-aria-on-one-of-two-carriers", title: "a two-ended widget announcing the state at one end",
    build: disabledDateRange, state: "disabled",
    mutate: (fx) => {
      // Half a range is not a range: the end date stays announceable while the field claims to be
      // unavailable, which is the shape a per-widget "somewhere" check cannot see.
      fx.parts.endControl.removeAttribute("aria-disabled");
      return { root: fx.root, kind: "daterange", state: "disabled", options: { parts: fx.parts } };
    },
  },
  {
    n: 18, id: "state-aria-wrong-value", title: "the carrier announcing the opposite of the state",
    build: selectField, state: "open",
    mutate: (fx) => {
      fx.parts.trigger.setAttribute("aria-expanded", "false");
      return { root: fx.root, kind: "select", state: "open", options: { parts: fx.parts, control: fx.parts.trigger } };
    },
  },
];

/**
 * Known false greens: the inspector cannot see these yet. Tasks 06 and 07 close them.
 * Shrinking this list is the deliverable of Milestone A — do not grow it to make a build pass.
 */
const EXPECTED_UNCAUGHT = new Set([
  // Empty. Every one of the fifteen is caught, each by a rule that names the part it broke.
  //
  // Keep it empty. A mutation that stops being caught is a regression, and the assertion below
  // will say so.
]);

/** Run every mutation once and record what the inspector actually said. */
function runAll() {
  const results = [];
  for (const mutation of MUTATIONS) {
    const fx = mutation.build();
    let issues;
    try {
      const { root, kind, state, options } = mutation.mutate(fx);
      // A mutation that names a state is about what the widget *announces*, not how it is shaped,
      // so it is judged by the state inspector. Both report the same way: a code and a message.
      issues = state
        ? inspectWidgetState(root, kind, state, options)
        : inspectWidgetDom(root, kind, options);
    } catch (error) {
      issues = [{ code: "THREW", part: "?", message: String(error && error.message) }];
    }
    results.push({ ...mutation, issues, caught: issues.length > 0 });
    clearMounted();
  }
  return results;
}

const RESULTS = runAll();

/** The same question of the lifecycle inspector: did it reject what it exists to reject. */
const LIFECYCLE_RESULTS = LIFECYCLE_MUTATIONS.map((mutation) => {
  let issues;
  try {
    issues = mutation.run();
  } catch (error) {
    issues = [{ code: "THREW", detail: String(error && error.message) }];
  }
  clearMounted();
  return { ...mutation, issues, caught: issues.length > 0 };
});

for (const mutation of LIFECYCLE_RESULTS) {
  const label = `lifecycle mutation ${mutation.n} — ${mutation.title}`;
  test(`${label} is rejected`, () => {
    assert.ok(
      mutation.issues.length > 0,
      `${label} was accepted. The lifecycle inspector is what stands between a renderer that leaks ` +
        `and a suite that says nothing.`,
    );
    assert.ok(
      mutation.issues.some((issue) => issue.code === mutation.expect),
      `${label} was reported, but not as ${mutation.expect} — which is the rule it breaks. Reported: ` +
        mutation.issues.map((issue) => issue.code).join(", "),
    );
    // Locatable, like every other issue: a code from the contract's own vocabulary and a detail.
    for (const issue of mutation.issues) {
      assert.match(issue.code, /^[A-Z_]+$/, `${label}: an issue with no code names nothing`);
      assert.ok(
        typeof issue.detail === "string" && issue.detail.length > 0,
        `${label}: an issue with no detail cannot be acted on`,
      );
    }
  });
}

test("every unmutated fixture conforms", () => {
  for (const [name, build] of Object.entries({ textField, dateRange, selectField })) {
    const fx = build();
    const issues = inspectWidgetDom(fx.root, {
      textField: "text", dateRange: "daterange", selectField: "select",
    }[name], { parts: fx.parts });
    assert.deepEqual(issues, [], `${name} should conform, got ${JSON.stringify(issues)}`);
    clearMounted();
  }
});

test("every unmutated fixture is in the state its mutation breaks", () => {
  // Without this, a state mutation could be caught for a defect the fixture already had, and the
  // suite would report a gate it does not have.
  const open = selectField();
  assert.deepEqual(
    inspectWidgetState(open.root, "select", "open", { parts: open.parts, control: open.parts.trigger }),
    [],
  );
  clearMounted();

  const disabled = disabledDateRange();
  assert.deepEqual(
    inspectWidgetState(disabled.root, "daterange", "disabled", { parts: disabled.parts }),
    [],
  );
  clearMounted();
});

test("the mutation table", () => {
  const rows = RESULTS.map((r) => {
    const codes = [...new Set(r.issues.map((i) => i.code))].join(", ") || "—";
    return `    ${String(r.n).padStart(2)}. ${r.title.padEnd(52)} ${r.caught ? "caught" : "PASSES"}  ${codes}`;
  });
  const caught = RESULTS.filter((r) => r.caught).length;
  console.log(
    `\n  mutation suite: ${caught}/${RESULTS.length} caught, ${RESULTS.length - caught} false greens\n` +
      rows.join("\n") + "\n",
  );
});

for (const mutation of MUTATIONS) {
  const expectCaught = !EXPECTED_UNCAUGHT.has(mutation.id);
  const label = `mutation ${mutation.n} — ${mutation.title}`;

  test(expectCaught ? `${label} is rejected` : `${label} is a known false green`, () => {
    const issues = RESULTS.find((r) => r.id === mutation.id).issues;

    if (expectCaught) {
      assert.ok(
        issues.length > 0,
        `${label} was accepted. If this is deliberate, add "${mutation.id}" to EXPECTED_UNCAUGHT ` +
          `with a reason — but a mutation that stops being caught is normally a regression.`,
      );
      // "Something is wrong" is not locatable. Every issue must name a rule and the place it broke:
      // a part for an anatomy issue, and for a state issue the part named inside the message, since
      // a state issue is about a kind × state pair rather than about one part of the anatomy.
      for (const issue of issues) {
        assert.ok(issue.code, `${label}: issue has no code — ${JSON.stringify(issue)}`);
        assert.ok(issue.message, `${label}: issue has no message — ${JSON.stringify(issue)}`);
        if (mutation.state) {
          assert.equal(issue.state, mutation.state, `${label}: issue names the wrong state`);
          assert.match(
            issue.message, /\bon [a-zA-Z]+/,
            `${label}: a state issue must name the carrier — ${issue.message}`,
          );
        } else {
          assert.ok(issue.part, `${label}: issue has no part — ${JSON.stringify(issue)}`);
        }
      }
    } else {
      assert.equal(
        issues.length, 0,
        `${label} is now caught (${issues.map((i) => i.code).join(", ")}). That is progress: ` +
          `remove "${mutation.id}" from EXPECTED_UNCAUGHT so the suite holds the new ground.`,
      );
    }
  });
}
