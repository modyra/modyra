/**
 * The list changed under the reading position.
 *
 * Every widget controller is driven by two kinds of call: an intent, dispatched, and a setter, called
 * directly. `subscribeController` is what every adapter re-renders on, and both kinds are supposed to
 * reach it — a setter that changes the controller and tells nobody changes nothing a person can see.
 *
 * Swept across the published surface: ten controllers, thirty-one setters. Twenty-eight announce
 * themselves. Three do not, and all three are on the select — `setOptions`, `setDescribedBy` and
 * `setPopupRendered`. `setOptions` is the one that matters most, because it is the only published
 * route for changing what a select offers and the reason to call it is nearly always that the options
 * have just arrived from somewhere. It is also the one that settles what kind of defect this is:
 * `createMultiselectFieldController` and `createOptionFieldController` both have `setOptions` and
 * both announce it. So this is not a design in which lists are set quietly.
 *
 * The accessible consequence is the second battle. Open the list, move to the last option, let a
 * shorter list arrive: `aria-activedescendant` still names the option that left. A screen reader is
 * pointed at an element that is not in the document — A11Y-001's case exactly, and it does not
 * resolve on settling, because settling is what never happens. The next keystroke clears it, which
 * is to say the person has to act before the pointer stops lying about where they are.
 *
 * The sweep reads the controller list off the package rather than naming it, so a controller or a
 * setter added later is measured without this file being touched. A setter this battle has no
 * argument for is reported as unmeasured rather than passed `undefined`, because a setter that
 * throws is not evidence of anything.
 *
 * The third battle is the same finding seen from where a consumer stands: a React select painting
 * one row per option the hook reports, and `setOptions` called on it. Its config is memoized, so the
 * component settles and nothing here is the render loop of a separate finding.
 *
 * Measurement note, because it changes what the numbers mean: each measurement builds its own
 * controller. Sharing one lets a notification from an earlier call land inside a later window and be
 * counted as that call's — a first pass here did exactly that and read as `setOptions` notifying
 * sometimes. Isolated, across three runs, it never does.
 */

import * as widgets from "@modyra/widgets";
import { createForm, field, vanillaReactivity } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const { createSelectController, subscribeController } = widgets;

/** A list of `size` options, each naming itself. */
const list = (size) =>
  Array.from({ length: size }, (_, index) => ({ value: `v${index}`, label: `L${index}` }));

const settled = () => new Promise((resolve) => setTimeout(resolve, 35));

/** What each setter can be given that differs from what a fresh controller already holds. */
const ARGUMENT = Object.freeze({
  setChecked: true,
  setReadonly: true,
  setDisabled: true,
  setInvalid: true,
  setLoading: true,
  setOpen: true,
  setOptions: list(1),
  setDescribedBy: "some-id",
  setPopupRendered: true,
  setBounds: { min: "2026-01-01", max: "2026-12-31" },
});

/** `setValue` means a different shape for each kind, so it is answered by kind. */
const VALUE_FOR = Object.freeze({
  multiselect: ["v1"],
  datepicker: "2026-04-03",
  daterange: { start: "2026-04-03", end: "2026-04-05" },
  timepicker: "10:30",
  text: "typed",
  valuewidget: "typed",
  default: "v1",
});

const kindOf = (name) => name.replace(/^create/, "").replace(/(Field)?Controller$/, "").toLowerCase();

/** A controller of `name`, built the way its options want. */
function buildController(name) {
  const reactivity = vanillaReactivity();
  const kind = kindOf(name);
  if (kind === "valuewidget") {
    return { controller: widgets[name]({ kind: "text", value: "" }, reactivity), reactivity };
  }
  const initial = kind === "multiselect" ? field([]) : kind === "boolean" ? field(false) : field(null);
  const form = createForm({ f: initial }, { reactivity, devWarnings: false });
  return {
    controller: widgets[name]({ widgetId: "w", options: list(3), handle: form.f.f }, reactivity),
    reactivity,
  };
}

battle(
  {
    claims: ["API-001"],
    title: "every published setter reaches whoever is drawing the widget",
    environments: ["node"],
  },
  async (ctx) => {
    const names = Object.keys(widgets).filter((name) => /^create\w+Controller$/.test(name)).sort();

    // The premise: there is a surface here to sweep. A rename upstream that emptied this list would
    // otherwise leave the battle green with nothing measured.
    expectClaim(names.length >= 8, {
      claimIds: ["API-001"],
      what: "the package exposes almost no controllers, so this sweep is measuring nothing",
      detail: JSON.stringify(names),
    });

    const heard = [];
    const unmeasured = [];
    for (const name of names) {
      let setters;
      try {
        setters = Object.keys(buildController(name).controller)
          .filter((key) => /^set/.test(key));
      } catch (error) {
        unmeasured.push({ name, why: `cannot build: ${String(error.message).slice(0, 60)}` });
        continue;
      }

      for (const setter of setters) {
        const argument = setter === "setValue"
          ? (VALUE_FOR[kindOf(name)] ?? VALUE_FOR.default)
          : ARGUMENT[setter];
        if (argument === undefined) {
          unmeasured.push({ name, setter, why: "this battle has no argument for it" });
          continue;
        }

        // Fresh per measurement: a controller carried between them lets an earlier notification
        // arrive inside this window and be read as this call's.
        const { controller, reactivity } = buildController(name);
        let count = 0;
        subscribeController(controller, reactivity, () => { count += 1; });
        await settled();

        const before = count;
        controller[setter](argument);
        await settled();
        heard.push({ name, setter, notifications: count - before });
      }
    }

    const silent = heard.filter((each) => each.notifications === 0);
    ctx.log.note("what each setter told its subscribers", {
      measured: heard.length,
      silent,
      unmeasured,
    });

    // The control: most of this surface does announce itself, so a silent one is that setter rather
    // than a subscription this battle never made live.
    expectClaim(heard.length - silent.length >= heard.length / 2, {
      claimIds: ["API-001"],
      what: "half the setters or more told nobody, which is a broken subscription rather than a finding about any one of them",
      detail: JSON.stringify({ measured: heard.length, silent: silent.length }),
    });

    expectEqual(silent, [], {
      claimIds: ["API-001"],
      what: "a setter changed a controller and told no subscriber, so nothing redraws until something else happens",
    });
  },
);

battle(
  {
    claims: ["A11Y-001"],
    title: "the option being pointed at is one the list still has",
    environments: ["node"],
  },
  async (ctx) => {
    const reactivity = vanillaReactivity();
    const controller = createSelectController({ widgetId: "s", options: list(3) }, reactivity);
    const active = () => controller.view().root.attributes["aria-activedescendant"] ?? null;
    const held = () => (controller.state().options ?? []).map((option) => `s__option__${option.value}`);

    controller.dispatch({ type: "open", source: "keyboard" });
    controller.dispatch({ type: "move", target: "last" });
    await settled();
    ctx.log.note("open, at the last option", { active: active(), held: held() });

    // The control: while nothing has changed, the pointer names an option that is there. So a
    // dangling one below is the change rather than an id that never matched.
    expectClaim(active() !== null && held().includes(active()), {
      claimIds: ["A11Y-001"],
      what: "the active option was not one of the offered ones before anything changed",
      detail: JSON.stringify({ active: active(), held: held() }),
    });

    // A shorter list arrives, without the option being pointed at.
    controller.setOptions(list(1));
    await settled();
    ctx.log.note("a shorter list arrived", { active: active(), held: held() });

    // Either it points at something the list still has, or it points at nothing. Naming an element
    // that is not in the document is what a screen reader cannot recover from.
    expectClaim(active() === null || held().includes(active()), {
      claimIds: ["A11Y-001"],
      what: "the active option is one the list no longer offers, so aria-activedescendant names an element that is not there",
      detail: JSON.stringify({ active: active(), held: held() }),
    });
  },
);

battle(
  {
    claims: ["API-001"],
    title: "a select repaints when its options are changed the documented way",
    environments: ["node"],
  },
  async (ctx) => {
    const { JSDOM } = await import("jsdom");
    const dom = new JSDOM("<!doctype html><div id=root></div>", { url: "http://localhost/" });
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
    globalThis.HTMLElement = dom.window.HTMLElement;
    globalThis.Node = dom.window.Node;
    globalThis.requestAnimationFrame = (run) => setTimeout(run, 0);
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;

    const React = (await import("react")).default;
    const { createRoot } = await import("react-dom/client");
    const { flushSync } = await import("react-dom");
    const { useMdySelect } = await import("@modyra/react");

    const first = list(2);
    const next = [{ value: "x", label: "Xi" }, { value: "y", label: "Yi" }, { value: "z", label: "Zeta" }];
    const lookup = () => ({ tagName: "INPUT", focus() {}, scrollIntoView() {}, setAttribute() {}, removeAttribute() {} });
    const handlers = new Proxy({}, { get: () => () => {}, has: () => true });

    let api = null;
    const Probe = () => {
      // Held still on purpose: a config written at the call never settles, which is a different
      // finding and would hide this one behind its own renders.
      const config = React.useMemo(() => ({ widgetId: "s", options: first, onChange: () => {} }), []);
      api = useMdySelect(config, lookup, handlers);
      return React.createElement(
        "ul",
        null,
        api.state.options.map((option) => React.createElement("li", { key: option.value }, option.label)),
      );
    };

    const root = createRoot(document.getElementById("root"));
    const quietly = (run) => {
      const real = console.error;
      console.error = () => undefined;
      try { return run(); } finally { console.error = real; }
    };
    const painted = () => [...document.querySelectorAll("li")].map((item) => item.textContent).join(",");

    quietly(() => flushSync(() => root.render(React.createElement(Probe))));
    await settled();

    // The control: the component paints what the hook reports, so a page that does not change below
    // is the change not arriving rather than a component that paints nothing.
    expectEqual(painted(), "L0,L1", {
      claimIds: ["API-001"],
      what: "the component did not paint the options the hook reported to begin with",
      detail: painted(),
    });

    api.setOptions(next);
    await settled();
    ctx.log.note("after the options were changed the documented way", {
      onThePage: painted(),
      theHookSays: api.state.options.map((option) => option.label).join(","),
    });

    // The premise: the call did reach the controller. What is at issue is the page.
    expectEqual(api.state.options.map((option) => option.label).join(","), "Xi,Yi,Zeta", {
      claimIds: ["API-001"],
      what: "setOptions did not reach the controller at all, so this battle is measuring the wrong thing",
    });

    expectEqual(painted(), "Xi,Yi,Zeta", {
      claimIds: ["API-001"],
      what: "the only published way to change a select's options left the old ones on the page",
      detail: JSON.stringify({ onThePage: painted(), theHookSays: api.state.options.map((o) => o.label) }),
    });

    root.unmount();
  },
);
