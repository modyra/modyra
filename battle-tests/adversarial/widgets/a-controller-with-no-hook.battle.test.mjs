/**
 * A hook for each widget controller, counted.
 *
 * `docs/guides/headless-recipes.md` states the adapters' division plainly: *"`@modyra/react` ships a
 * hook for each widget controller. The other four reactivity adapters ship two, and that is a
 * deliberate gap rather than an oversight."* The four are named in the guide and measured here as
 * two apiece, which is the half that holds.
 *
 * The other half is a count. `@modyra/widgets` publishes seven controllers for a concrete field kind
 * — boolean, datepicker, daterange, multiselect, option, select, text — and `@modyra/react` publishes
 * a hook for six of them. `daterange` is a kind in every list the contract keeps: `MDY_FIELD_KINDS`,
 * `MDY_VALUE_CONTRACTS` (`{shape: "dateRange", commit: "complete"}`) and the seventeen structure
 * nodes of `MDY_WIDGET_CONTRACTS`. It has a controller. It has no hook, and no line of the guide says
 * it is an exception.
 *
 * A missing wrapper is ergonomics rather than capability — the guide is right about that, and says
 * how to drive a controller without one. What is measured here is the sentence: an adapter that says
 * it wraps every controller wraps every controller, or the one it leaves out is named.
 *
 * Two ways to green, and the battle takes either: the hook exists, or the guide names the kind it
 * does not ship.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
/**
 * Whether the guide names this controller as one it leaves unwrapped on purpose.
 *
 * **A word in the prose is not a declaration.** Searching the whole document for the kind's name
 * exempted every kind whose name is an ordinary English word — `file`, `select`, `text`, `option`
 * all appear in that guide as English, so the branch excused exactly the kinds most likely to be
 * forgotten, a common word being what a common kind is called. Three controllers shipped without a
 * wrapper and this reported one.
 *
 * So the exemption is read where it is argued — the section that states the division — and it has to
 * be written as code rather than used as a word: the kind in a code span, or the hook that is missing
 * by name. A sentence that happens to contain "file" cannot excuse the file controller.
 */
const SECTION = "## A widget controller without a wrapper";

export function documentsTheGap(guide, controller) {
  const from = guide.indexOf(SECTION);
  if (from === -1) return false;
  const rest = guide.slice(from + SECTION.length);
  const to = rest.indexOf("\n## ");
  const section = to === -1 ? rest : rest.slice(0, to);
  const kind = controller.replace(/^create/, "").replace(/FieldController$|Controller$/, "");
  const spans = [...section.matchAll(/`([^`\n]+)`/g)].map(([, inner]) => inner.toLowerCase());
  return spans.includes(kind.toLowerCase()) || spans.includes(hookNameFor(controller).toLowerCase());
}

const GUIDE = resolve(HERE, "..", "..", "..", "docs", "guides", "headless-recipes.md");

/**
 * The controllers a field kind is rendered through.
 *
 * `createCatalogWidgetController` and `createValueWidgetController` are the generic two: they take a
 * kind rather than being one, so a wrapper per kind is not what they would have.
 */
const GENERIC = new Set(["createCatalogWidgetController", "createValueWidgetController"]);

/** `createDatepickerFieldController` and `useMdyDatepickerField` are the same widget, spelled twice. */
function hookNameFor(controller) {
  return `useMdy${controller.replace(/^create/, "").replace(/Controller$/, "")}`;
}

battle(
  {
    claims: ["ADP-001"],
    title: "an adapter that wraps every controller wraps every controller",
    environments: ["node"],
  },
  async (ctx) => {
    const widgets = await import("@modyra/widgets");
    const react = await import("@modyra/react");
    const guide = readFileSync(GUIDE, "utf8");

    const controllers = Object.keys(widgets)
      .filter((name) => /^create.*Controller$/.test(name) && !GENERIC.has(name))
      .sort();
    const hooks = new Set(Object.keys(react).filter((name) => name.startsWith("useMdy")));

    // The premise: there are controllers to wrap, and react wraps most of them — so a missing one is
    // a gap in a pattern rather than a package that never had the pattern.
    expectClaim(controllers.length >= 5 && controllers.filter((c) => hooks.has(hookNameFor(c))).length >= 4, {
      claimIds: ["ADP-001"],
      what: "react wraps almost none of the widget controllers, so there is no pattern here for one kind to fall out of",
      detail: JSON.stringify({ controllers, hooks: [...hooks] }),
    });

    const unwrapped = controllers.filter((controller) => !hooks.has(hookNameFor(controller)));
    ctx.log.note("controllers against the hooks that wrap them", {
      controllers,
      unwrapped: unwrapped.map((controller) => ({ controller, expected: hookNameFor(controller) })),
    });

    const undocumented = unwrapped.filter((controller) => !documentsTheGap(guide, controller));

    expectEqual(undocumented, [], {
      claimIds: ["ADP-001"],
      what: "a widget controller has no hook in the adapter whose guide says it ships one for each, and no line of that guide says which kind it leaves out",
    });
  },
);

battle(
  {
    claims: ["ADP-001"],
    title: "the four adapters the guide calls two-hook ship two",
    environments: ["node"],
  },
  async (ctx) => {
    // The other half of the same sentence, and the reason the first battle is about a count rather
    // than about react being ahead: the gap the guide declares is the one that is there.
    const measured = {};
    for (const name of ["preact", "solid", "svelte", "vue"]) {
      const adapter = await import(`@modyra/${name}`);
      const widgetHooks = Object.keys(adapter).filter((key) => /^useMdy(TextField|Field|Select)$/.test(key));
      // preact's field-state hook shares the family's spelling, so what is counted is the bridge:
      // a text hook and a select hook, whichever of the two spellings this adapter uses for the text.
      measured[name] = widgetHooks.includes("useMdyTextField")
        ? widgetHooks.filter((key) => key !== "useMdyField").length
        : widgetHooks.length;
    }
    ctx.log.note("the widgets bridge, per adapter", measured);

    expectEqual(measured, { preact: 2, solid: 2, svelte: 2, vue: 2 }, {
      claimIds: ["ADP-001"],
      what: "an adapter the guide describes as shipping two bridge hooks ships a different number, so the sentence is wrong about the four as well",
    });
  },
);
