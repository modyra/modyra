/**
 * The other adapter's answer to a field list that grew.
 *
 * `<mdy-dynamic-form [fields]>` and React's `useMdyDynamicForm(fields)` are the two doors the guides
 * name side by side onto the same Dynamic Form Contract, and they reach the same function the same
 * way: an effect over the field list calling `applyFlatValidators(form, fields, "mdy-dynamic")`.
 *
 * They do not answer alike. React fixes its schema at first render, so a list that gained a name
 * hands `upsertValidators` a rule for a field the form does not declare; the refusal is correct and
 * it happens inside an effect, where React can only unwind the tree. Angular's inner form takes its
 * schema from the same input, so the name is declared before the rule for it arrives.
 *
 * This pins that half. It is the evidence that growing the list is a thing the contract can do at
 * all — not a limit of the contract that React happens to expose — and it has to keep being true,
 * because a repair on the other side that made both fail would satisfy "they agree".
 *
 * Drawn is not the same as wired, so the added field is checked for its rule and not only for its
 * control: `required` is a declared fact, and a fact reaches the control it constrains.
 */

import { JSDOM } from "jsdom";

import { battle } from "../harness/battle.mjs";
import { expectClaim, expectEqual } from "../harness/assertions.mjs";
import { assertFreshBuild } from "../harness/build-freshness.mjs";

/** A DOM and the globals Angular reads off it. */
function browser() {
  const dom = new JSDOM("<!doctype html><html><body><div id=root></div></body></html>", {
    url: "http://localhost/",
  });
  for (const name of [
    "window", "document", "HTMLElement", "Node", "Element", "Event", "CustomEvent",
    "KeyboardEvent", "MouseEvent", "getComputedStyle", "DOMParser", "NodeFilter",
  ]) {
    globalThis[name] = dom.window[name];
  }
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  return dom;
}

const painted = () => new Promise((resolve) => setTimeout(resolve, 60));

const field = (name, validators) => ({
  name,
  kind: "text",
  label: name.toUpperCase(),
  ...(validators ? { validators } : {}),
});

battle(
  {
    claims: ["API-001", "DYN-001"],
    title: "a field list that gained a name is rendered, and the name it gained is enforced",
    environments: ["node"],
  },
  async (ctx) => {
    ctx.log.note("the build this battle is about to measure", assertFreshBuild("angular"));

    browser();
    await import("@angular/compiler");
    const ng = await import("@angular/core");
    const platform = await import("@angular/platform-browser");
    const { MdyDynamicFormComponent } = await import("@modyra/angular");

    const app = await platform.createApplication({
      providers: [ng.provideZonelessChangeDetection()],
    });
    const host = document.getElementById("root");

    const one = [field("email", { required: true })];
    const two = [...one, field("phone", { required: true })];

    const component = ng.createComponent(MdyDynamicFormComponent, {
      environmentInjector: app.injector,
      hostElement: host,
    });
    component.setInput("fields", one);
    app.attachView(component.hostView);
    await painted();

    const controls = () => [...host.querySelectorAll("input")];
    ctx.log.note("what one field renders", { controls: controls().length });

    // The control: one field really does render one control, so a count of two afterwards is the
    // list growing rather than a component that renders whatever it is holding twice.
    expectEqual(controls().length, 1, {
      claimIds: ["DYN-001"],
      what: "a one-field document did not render exactly one control",
    });

    // The list grows, which is what a config-driven application does to it.
    let refused = null;
    try {
      component.setInput("fields", two);
      await painted();
    } catch (error) {
      refused = error;
    }

    ctx.log.note("what the page holds after the list grew", {
      controls: controls().length,
      refused: refused === null ? null : String(refused.message).slice(0, 140),
      labels: [...host.querySelectorAll("label")].map((label) => label.textContent.trim()),
    });

    expectClaim(refused === null, {
      claimIds: ["API-001"],
      what: "adding a field to the document was refused",
      detail: String(refused?.message ?? "").slice(0, 200),
    });

    expectEqual(controls().length, 2, {
      claimIds: ["DYN-001"],
      what: "the field the document gained was not rendered",
    });

    // And it is wired, not only drawn. `required` is a declared fact, and a fact constrains the
    // control it belongs to — a field rendered without its rule is the same defect one layer down.
    expectClaim(controls().every((input) => input.getAttribute("aria-required") === "true"), {
      claimIds: ["API-001", "DYN-001"],
      what: "a field the document gained was rendered without the rule the document gave it",
      detail: JSON.stringify(controls().map((input) => input.getAttribute("aria-required"))),
    });
  },
);
