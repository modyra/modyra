/**
 * The object a React consumer writes at the call, and the loop it starts.
 *
 * Every widget hook takes a config object: `useMdySelect(config, lookup, handlers)`,
 * `useMdyOptionField(handle, config)`, and four more of the same shape. Each memoizes its controller
 * on that object's *identity* — `useMemo(() => create…Controller(…), [options, handle, reactivity])`
 * — and then subscribes to the controller, and the subscription sets state.
 *
 * A React consumer writes the config where it is used, because that is what an argument that is an
 * object literal invites. Then every render builds a new object, which builds a new controller,
 * which resubscribes, which sets state, which renders. It does not settle: React reports "Maximum
 * update depth exceeded" and keeps going.
 *
 * The requirement is real but unwritten — a source comment on one of the six says "callers should
 * memoize options or use a stable key", and nothing published says it at all. It is also harsher
 * than it sounds: `useMdyBooleanField`'s config carries no options, only a `widgetId`, and it loops
 * just the same, because what is compared is the object rather than anything in it. A consumer
 * cannot pass any literal to any of these hooks.
 *
 * `@modyra/preact` is built the same way and does the same thing, with one difference worth knowing:
 * React reports "Maximum update depth exceeded" and preact reports nothing, so there the loop is
 * silent. Its rate is steady rather than explosive — renders grow linearly with how long the
 * component is left mounted — which is why that half is measured over two windows instead of one.
 *
 * The battle counts renders. A hook that settles renders a handful; one that does not renders
 * hundreds or thousands, so the bound below does not need to be delicate, and a repair that costs a
 * few extra renders still passes. Every plausible repair leaves it green: memoizing on the config's
 * contents, holding the controller in a ref, or subscribing without setting state on subscribe.
 */

import { JSDOM } from "jsdom";

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

/** A DOM and the globals React reads off it. */
function browser() {
  const dom = new JSDOM("<!doctype html><div id=root></div>", { url: "http://localhost/" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.requestAnimationFrame = (run) => setTimeout(run, 0);
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  return dom;
}

const OPTIONS = Object.freeze([
  Object.freeze({ value: "a", label: "Alpha" }),
  Object.freeze({ value: "b", label: "Beta" }),
]);

/** A widget command reaches for an element and a handler; neither is what this battle is about. */
const LOOKUP = () => ({ tagName: "INPUT", focus() {}, scrollIntoView() {}, setAttribute() {}, removeAttribute() {} });
const HANDLERS = new Proxy({}, { get: () => () => {}, has: () => true });

/** How many renders a hook that settles is allowed, generously. Neither answer is near it. */
const SETTLED = 25;

const settle = () => new Promise((resolve) => setTimeout(resolve, 150));

battle(
  {
    claims: ["API-001", "REA-001"],
    title: "a widget hook given the config written at its call settles",
    environments: ["node"],
  },
  async (ctx) => {
    browser();
    const React = (await import("react")).default;
    const { createRoot } = await import("react-dom/client");
    const { flushSync } = await import("react-dom");
    const m = await import("@modyra/react");

    /** Each published widget hook, with the config a consumer writes for it. */
    const hooks = [
      ["useMdySelect", () => ({ widgetId: "w", options: OPTIONS, onChange: () => {} }),
        (config) => m.useMdySelect(config, LOOKUP, HANDLERS), () => m.field(null)],
      ["useMdyOptionField", () => ({ widgetId: "w", options: OPTIONS }),
        (config, handle) => m.useMdyOptionField(handle, config), () => m.field(null)],
      ["useMdyMultiselectField", () => ({ widgetId: "w", options: OPTIONS }),
        (config, handle) => m.useMdyMultiselectField(handle, config), () => m.field([])],
      ["useMdyBooleanField", () => ({ widgetId: "w" }),
        (config, handle) => m.useMdyBooleanField(handle, config), () => m.field(false)],
      ["useMdyDatepickerField", () => ({ widgetId: "w" }),
        (config, handle) => m.useMdyDatepickerField(handle, config), () => m.field(null)],
      ["useMdyTimepickerField", () => ({ widgetId: "w" }),
        (config, handle) => m.useMdyTimepickerField(handle, config), () => m.field(null)],
    ];

    /** Mount one hook once and report how hard React had to work to reach a resting state. */
    const mount = async (makeConfig, call, makeField, stable) => {
      let renders = 0;
      const Component = () => {
        renders += 1;
        const form = m.useMdyForm(() => ({ v: makeField() }));
        const config = stable ? React.useMemo(makeConfig, []) : makeConfig();
        call(config, form.f.v);
        return null;
      };

      const root = createRoot(document.getElementById("root"));
      const said = [];
      const realError = console.error;
      console.error = (...parts) => said.push(parts.map(String).join(" "));
      try {
        flushSync(() => root.render(React.createElement(Component)));
        await settle();
      } finally {
        console.error = realError;
      }
      root.unmount();
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { renders, exceeded: said.filter((line) => line.includes("Maximum update depth")).length };
    };

    const measured = [];
    for (const [name, makeConfig, call, makeField] of hooks) {
      const held = await mount(makeConfig, call, makeField, true);
      const written = await mount(makeConfig, call, makeField, false);
      measured.push({ name, memoized: held.renders, inline: written.renders, exceeded: written.exceeded });
    }
    ctx.log.note("renders each hook needed to settle", { measured });

    // The control: held still, every one of them settles in a couple of renders. So a count in the
    // thousands below is the config's identity rather than this battle's mounting.
    for (const { name, memoized } of measured) {
      expectClaim(memoized <= SETTLED, {
        claimIds: ["REA-001"],
        what: `${name} did not settle even when its config was held still, so nothing here measures identity`,
        detail: JSON.stringify({ renders: memoized }),
      });
    }

    for (const { name, inline, exceeded } of measured) {
      expectClaim(inline <= SETTLED && exceeded === 0, {
        claimIds: ["API-001", "REA-001"],
        what: `${name} never stopped rendering when its config was written at the call`,
        detail: JSON.stringify({ renders: inline, maximumUpdateDepthReports: exceeded }),
      });
    }
  },
);

battle(
  {
    claims: ["API-001", "REA-001"],
    title: "the same config, in the other hook-shaped adapter, settles too",
    environments: ["node"],
  },
  async (ctx) => {
    browser();
    globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
    const { h, render } = await import("preact");
    const { useMemo } = await import("preact/hooks");
    const m = await import("@modyra/preact");

    const host = document.getElementById("root");
    const makeConfig = () => ({ widgetId: "w", options: OPTIONS, onChange: () => {} });

    /** Mount for a while and report how many times the component ran. */
    const mount = async (stable, ms) => {
      let renders = 0;
      const Probe = () => {
        renders += 1;
        const config = stable ? useMemo(makeConfig, []) : makeConfig();
        m.useMdySelect(config, LOOKUP, HANDLERS);
        return null;
      };
      render(h(Probe), host);
      await new Promise((resolve) => setTimeout(resolve, ms));
      render(null, host);
      await new Promise((resolve) => setTimeout(resolve, 20));
      return renders;
    };

    // Two windows, because a loop that runs at a steady rate is only visible as one when the time it
    // is given changes. A settled hook answers the same number for both.
    const held = { short: await mount(true, 200), long: await mount(true, 600) };
    const written = { short: await mount(false, 200), long: await mount(false, 600) };
    ctx.log.note("renders over two windows", { held, written });

    // The control: held still, the count does not depend on how long it is left alone.
    expectClaim(held.short <= SETTLED && held.long <= SETTLED && held.short === held.long, {
      claimIds: ["REA-001"],
      what: "the hook did not settle even with its config held still, so nothing here measures identity",
      detail: JSON.stringify(held),
    });

    expectClaim(written.short <= SETTLED && written.long <= SETTLED, {
      claimIds: ["API-001", "REA-001"],
      what: "the hook kept rendering for as long as it was mounted when its config was written at the call",
      detail: JSON.stringify({ ...written, note: "preact reports nothing while it does this" }),
    });
  },
);
