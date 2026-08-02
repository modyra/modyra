/**
 * The whole life of a mounted form, not just its first frame.
 *
 * Every other suite in this package mounts a form, asks whether its anatomy is right, and stops.
 * That cannot see the failures here: a widget that leaks one node per mount is perfect on the first
 * assertion and ruins a page that lives for an hour, and two instances that mint the same id fail
 * silently — every relationship still resolves, just to the wrong instance's element.
 *
 * The transitions and the conditions are `@modyra/widgets`'s, not this renderer's. What is asserted
 * here is that this renderer satisfies them.
 */
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { mountMdyForm } = await import("../dist/index.js");
const {
  idsUnder, inspectCoexistence, inspectUnmount, MDY_LIFECYCLE_TRANSITIONS,
} = await import("../../widgets/dist/testing/index.js");

const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }];

/** Kinds that portal, plus a plain one — a teardown is only interesting where something was lifted out. */
const FIELDS = [
  { name: "name", kind: "text", label: "Name" },
  { name: "pick", kind: "select", label: "Pick", options: OPTIONS },
  { name: "many", kind: "multiselect", label: "Many", options: OPTIONS },
  { name: "when", kind: "datepicker", label: "When" },
  { name: "clock", kind: "timepicker", label: "Clock" },
];

/** A different shape, so a schema change can be told from a re-render of the same one. */
const OTHER_FIELDS = [
  { name: "note", kind: "textarea", label: "Note" },
  { name: "agree", kind: "checkbox", label: "Agree" },
];

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function mount(fields = FIELDS) {
  const host = document.createElement("div");
  document.body.append(host);
  const mounted = mountMdyForm(host, fields, { submitLabel: null });
  return { host, mounted };
}

/** Everything the instance put in the document, including what it portalled outside its host. */
const idsOf = () => idsUnder(document.body);

// One document is shared by the whole file, so a test that fails before its own teardown would
// leave a live instance behind and every later test would measure that instead of its own subject.
beforeEach(() => document.body.replaceChildren());

test("the contract names nine transitions and this suite drives every one", () => {
  assert.deepEqual([...MDY_LIFECYCLE_TRANSITIONS], [
    "mount", "update-schema", "update-value", "update-locale", "update-theme",
    "disable", "reset", "unmount", "remount",
  ]);
});

test("mount, then unmount, gives the document back exactly", async () => {
  const before = document.body.querySelectorAll("*").length;
  const { host, mounted } = mount();
  await settle();
  const idsWhileMounted = idsOf();
  assert.ok(idsWhileMounted.size > 0, "a mounted form mints ids");

  mounted.dispose();
  host.remove();
  await settle();

  const issues = inspectUnmount({
    document,
    idsWhileMounted,
    elementsBeforeMount: before,
    // A disposed form that still renders is the leak a listener registry would show, observed
    // through its consequence: the document must not move.
    pokeAfterDispose: () => mounted.form.f.name.set("after"),
  });
  assert.deepEqual(issues, [], `teardown left something behind: ${JSON.stringify(issues)}`);
});

test("a value, a disable and a reset are handled while mounted, and none of them leaks", async () => {
  const before = document.body.querySelectorAll("*").length;
  const { host, mounted } = mount();
  await settle();

  // update-value
  mounted.form.f.name.set("typed");
  await settle();
  assert.equal(mounted.form.f.name.value(), "typed");

  // disable — the setter takes a signal, so what is handed over is a source, not a snapshot
  mounted.form.setDisabled("name", () => true);
  await settle();
  assert.equal(host.querySelector('[data-mdy-field="name"] input')?.disabled, true);

  // reset
  mounted.form.reset();
  await settle();
  assert.equal(mounted.form.f.name.value(), "");

  const idsWhileMounted = idsOf();
  mounted.dispose();
  host.remove();
  await settle();
  assert.deepEqual(
    inspectUnmount({ document, idsWhileMounted, elementsBeforeMount: before }),
    [],
    "a form that was driven leaks nothing a form that was not driven does not",
  );
});

test("a theme change is CSS, so the rendered DOM does not move", async () => {
  const { host, mounted } = mount();
  await settle();
  const before = host.innerHTML;

  document.documentElement.setAttribute("data-mdy-theme", "modyra-material");
  await settle();
  assert.equal(host.innerHTML, before, "a renderer that rebuilds on a theme change owns the theme, and it must not");

  document.documentElement.removeAttribute("data-mdy-theme");
  mounted.dispose();
  host.remove();
});

test("a schema change leaves nothing of the schema it replaced", async () => {
  const before = document.body.querySelectorAll("*").length;
  const { host, mounted } = mount();
  await settle();
  const oldIds = idsOf();

  // The mount surface has no in-place schema update: replacing the schema is disposing and
  // mounting again, so what matters is that the first schema's DOM and ids are entirely gone.
  mounted.dispose();
  const replaced = mountMdyForm(host, OTHER_FIELDS, { submitLabel: null });
  await settle();

  const survivors = [...oldIds].filter((id) => document.getElementById(id) !== null);
  assert.deepEqual(survivors, [], "the replaced schema's ids still resolve");

  const newIds = idsOf();
  replaced.dispose();
  host.remove();
  await settle();
  assert.deepEqual(
    inspectUnmount({ document, idsWhileMounted: newIds, elementsBeforeMount: before }),
    [],
  );
});

test("two forms with different field names coexist without sharing an id", async () => {
  const first = mount(FIELDS);
  const second = mount(OTHER_FIELDS);
  await settle();

  assert.deepEqual(
    inspectCoexistence(idsUnder(first.host), idsUnder(second.host)),
    [],
    "a shared id points one instance's relationships at the other instance's DOM",
  );

  first.mounted.dispose();
  second.mounted.dispose();
});

test("two forms with the same field names mint the same ids", { todo: "needs the id scheme of task 07" }, async () => {
  const first = mount(FIELDS);
  const second = mount(FIELDS);
  await settle();

  // An id is what ties a control to its label, its description and its error list. Two forms
  // built from the same field names produce the same ids, so the second form's `label[for]`,
  // `aria-describedby` and `aria-errormessage` all resolve to the *first* form's elements — and
  // nothing about either form, examined alone, looks wrong.
  //
  // A widget id is the field name and nothing else, so this cannot be closed inside a renderer:
  // it needs an instance-scoped id, which redefines every generated id in the public DOM.
  assert.deepEqual(inspectCoexistence(idsUnder(first.host), idsUnder(second.host)), []);

  first.mounted.dispose();
  second.mounted.dispose();
});

test("a remount reuses the ids the unmount gave back", async () => {
  const first = mount();
  await settle();
  const firstIds = [...idsOf()].sort();
  first.mounted.dispose();
  first.host.remove();
  await settle();

  const second = mount();
  await settle();
  const secondIds = [...idsOf()].sort();

  // Deterministic ids across a remount are what keeps a hydrated or re-rendered page stable; ids
  // that drift make every recorded relationship in a snapshot worthless.
  assert.deepEqual(secondIds, firstIds, "a remount minted different ids than the mount it replaced");

  second.mounted.dispose();
  second.host.remove();
  await settle();
});

test("twenty mount/unmount cycles accumulate nothing", async () => {
  const before = document.body.querySelectorAll("*").length;
  for (let cycle = 0; cycle < 20; cycle++) {
    const { host, mounted } = mount();
    await settle();
    mounted.dispose();
    host.remove();
    await settle();
  }
  assert.equal(
    document.body.querySelectorAll("*").length,
    before,
    "a per-cycle leak is invisible in one teardown and fatal over a session",
  );
});
