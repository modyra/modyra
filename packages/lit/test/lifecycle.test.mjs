/**
 * The whole life of a mounted element, not just its first frame.
 *
 * The conditions are `@modyra/widgets`'s and were driven by one renderer only. A teardown obligation
 * checked in one place and declared for all is the shape this repository keeps finding: the
 * inspector gained `EFFECT_THREW_AFTER_UNMOUNT` and had a single consumer, so nothing said whether
 * the other renderers owed it too.
 *
 * The kinds here are the ones that portal. A teardown is only interesting where something was
 * lifted out of the element's own subtree, because that is the part `element.remove()` does not
 * take with it.
 */
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { mount, KINDS } = await import("./support/state-fixture.mjs");
const {
  idsUnder, inspectCoexistence, inspectUnmount, MDY_LIFECYCLE_ISSUE,
} = await import("../../widgets/dist/testing/index.js");

/** Where an overlay is lifted out of the element, so a teardown has somewhere to leave something. */
const PORTALLING = ["select", "multiselect", "datepicker", "daterange", "timepicker", "colors"];
const SUBJECTS = ["text", ...PORTALLING];

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

/** What the reactive runtime said while `run` executed — where a surviving effect announces itself. */
async function errorsDuring(run) {
  const raised = [];
  const original = console.error;
  console.error = (...args) => raised.push(args.map(String).join(" "));
  try { await run(); } finally { console.error = original; }
  return raised;
}

beforeEach(() => document.body.replaceChildren());

test("every kind this renderer draws is a subject or a deliberate omission", () => {
  const missing = SUBJECTS.filter((kind) => !KINDS.includes(kind));
  assert.deepEqual(missing, [], "a subject names a kind this renderer does not render");
});

for (const kind of SUBJECTS) {
  test(`${kind}: mount, then unmount, gives the document back exactly`, async () => {
    const before = document.body.querySelectorAll("*").length;
    const fixture = await mount(kind);
    await fixture.settle();

    // Opened first where there is something to open: a popup that was never shown was never
    // portalled, and the teardown of a portal is the half an element's own removal cannot do.
    if (PORTALLING.includes(kind)) {
      fixture.drive("open");
      await fixture.settle();
    }

    const idsWhileMounted = idsUnder(document.body);
    assert.ok(idsWhileMounted.size > 0, `${kind}: a mounted element mints ids`);

    fixture.dispose();
    await settle();

    let raised = [];
    const issues = inspectUnmount({
      document,
      idsWhileMounted,
      elementsBeforeMount: before,
      pokeAfterDispose: () => { fixture.handle.set(fixture.handle.value()); },
      errorsAfterDispose: () => raised,
    });

    assert.deepEqual(issues, [], `${kind}: ${issues.map((i) => `${i.code} — ${i.detail}`).join("; ")}`);
    raised = await errorsDuring(() => settle());
    assert.deepEqual(raised, [], `${kind}: an effect outlived its element — ${raised[0] ?? ""}`);
  });
}

test("two live instances of a kind do not mint the same id", async () => {
  const first = await mount("select");
  const second = await mount("select");
  await first.settle();
  await second.settle();

  const issues = inspectCoexistence(idsUnder(first.root), idsUnder(second.root));
  assert.deepEqual(
    issues.filter((i) => i.code === MDY_LIFECYCLE_ISSUE.idCollidedAcrossInstances),
    [],
    "two instances share an id, so one's relationships resolve to the other's DOM",
  );

  first.dispose();
  second.dispose();
});
