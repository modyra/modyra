/**
 * The list a search leaves, derived twice: by the controller, and by a renderer doing it again.
 *
 * The multiselect controller narrows for itself — `optionsWithUnrecognizedValues` widens the list to
 * include a held value the options do not contain, then `filterOptionsByQuery` narrows what is left
 * by `state().query`, and the result is offered as `filteredOptions`. Two renderers compose the same
 * two primitives themselves before handing the controller anything, and render their own answer.
 *
 * Two derivations that agree on every input anyone has tried are not verified — they are untested
 * together. This file looks for the input shape that separates them, and the shape it found is the
 * one below: the widening runs on both sides of the host's own filter, so a filter that rejects a
 * held value removes it on one route and the controller puts it back on the other.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  createMultiselectFieldController,
  filterOptionsByQuery,
  optionsWithUnrecognizedValues,
} from "../dist/index.js";
import { createForm, field, vanillaReactivity } from "../../core/dist/index.js";

const OPTIONS = [
  { value: "it", label: "Italy" },
  { value: "fr", label: "France" },
  { value: "de", label: "Germany" },
];

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A field handle holding `values`, on one runtime shared with whatever observes it. */
function benchFor(values) {
  const reactivity = vanillaReactivity();
  const form = createForm({ where: field(values) }, { reactivity });
  return { reactivity, handle: form.f.where };
}

/**
 * What a renderer that composes the primitives itself ends up drawing.
 *
 * Written as the renderers write it: widen for a held value the list does not carry, apply the
 * host's own filter, then narrow by the query.
 */
const rendererRoute = (options, values, filterFn, query) => {
  const painted = optionsWithUnrecognizedValues(options, values);
  const filtered = filterFn ? painted.filter((o) => filterFn(o.value)) : painted;
  return filterOptionsByQuery(filtered, query);
};

/** What the controller offers, given the same list the renderer would have handed it. */
async function controllerRoute(options, values, filterFn, query) {
  const { reactivity, handle } = benchFor(values);
  const painted = optionsWithUnrecognizedValues(options, values);
  const handed = filterFn ? painted.filter((o) => filterFn(o.value)) : painted;
  const controller = createMultiselectFieldController(
    { widgetId: "where", handle, options: handed, mode: "many" },
    reactivity,
  );
  controller.dispatch({ type: "search", query });
  await settle();
  const offered = controller.filteredOptions().map((o) => o.value);
  controller.destroy();
  return offered;
}

const labels = (options) => options.map((o) => o.value);

test("the two derivations agree when nothing is held outside the list", async () => {
  const cases = [
    { values: [], filterFn: null, query: "" },
    { values: [], filterFn: null, query: "ital" },
    { values: ["it"], filterFn: null, query: "an" },
    { values: ["it", "fr"], filterFn: (v) => v !== "de", query: "" },
    { values: ["it"], filterFn: (v) => v !== "de", query: "ital" },
    { values: [], filterFn: null, query: "zzz" },
  ];
  for (const { values, filterFn, query } of cases) {
    const mine = labels(rendererRoute(OPTIONS, values, filterFn, query));
    const theirs = await controllerRoute(OPTIONS, values, filterFn, query);
    assert.deepEqual(theirs, mine,
      `the two routes disagree on values=${JSON.stringify(values)} query=${JSON.stringify(query)}`);
  }
});

test("a held value the list does not carry is offered by the controller and not by the renderer", async () => {
  // The widening runs twice, on both sides of the host's filter. The renderer widens, the filter
  // takes the widened option away, and the controller — handed a list that once again lacks a value
  // the field holds — widens a second time and puts it back. Neither is doing something careless
  // with what it was given; the composition is what has two answers.
  const values = ["zz"];
  const filterFn = (v) => v !== "zz";

  const mine = labels(rendererRoute(OPTIONS, values, filterFn, ""));
  const theirs = await controllerRoute(OPTIONS, values, filterFn, "");

  assert.ok(!mine.includes("zz"), "the renderer route kept a value its own filter rejects");
  assert.ok(theirs.includes("zz"),
    "the controller dropped a held value the options do not carry — the widening this test is "
    + "about is not happening, so the divergence below is not the one being described");
  assert.notDeepEqual(theirs, mine,
    "the two routes agree here, so the divergence this file records has been closed and its "
    + "account is now wrong");
});

test("the divergence needs a filter that rejects the held value, and only that", async () => {
  // Without a filter, or with one that accepts it, the two routes agree on the same input. Stated so
  // the finding is not read as "the renderer and the controller disagree about search" — they agree
  // about search, and disagree about a value the field holds that nothing offers.
  const values = ["zz"];
  const mine = labels(rendererRoute(OPTIONS, values, null, ""));
  const theirs = await controllerRoute(OPTIONS, values, null, "");
  assert.deepEqual(theirs, mine, "the routes disagree with no filter in play, so the filter is not the cause");
  assert.ok(mine.includes("zz"), "the widening did not happen at all, so this case proves nothing");
});
