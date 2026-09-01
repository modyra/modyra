/**
 * A form built outside the browser reaches the same verdicts as one built inside it.
 *
 * The property is not readable from a snapshot: a serialization can look entirely well-formed and
 * still describe a form that computed something different. So the two roads are put in the same run
 * and their verdicts compared — validity, which fields are in play, synchronous errors, values.
 *
 * Road A is the browser: build, write, read the verdicts.
 * Road B is the server: build, snapshot, restore, read the verdicts.
 *
 * What this cannot see is stated so it is not assumed: both roads run the same reactivity here, so
 * agreement is evidence that serialization round-trips, not that a different runtime would agree.
 * A runtime whose computations freeze at creation is the case that motivates the whole path, and it
 * is planted rather than waited for.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createForm, field, required, minLength, vanillaReactivity } from "../dist/index.js";
import { mdyServerSnapshot, mdyRestoreSnapshot } from "../dist/server-snapshot.js";

const RX = vanillaReactivity();

const SCHEMA = () => ({
  name: field("", [required("Name is required")]),
  code: field("ab", [minLength(3, "too short")]),
});

/** Everything a consumer would act on. Deliberately not the snapshot's own shape. */
const verdicts = (form) => ({
  valid: form.state.valid(),
  pending: form.state.pending(),
  fields: form.fieldNames().map((path) => {
    const state = form.getField(path)();
    return {
      path,
      value: state.value(),
      valid: state.valid(),
      pending: state.pending(),
      errors: state.errors().map((each) => each.message),
    };
  }),
});

const written = (form) => {
  form.f.name.set("Ada");
  return form;
};

test("the two roads reach the same verdicts", () => {
  const inTheBrowser = verdicts(written(createForm(SCHEMA())));

  const onTheServer = written(createForm(SCHEMA()));
  const carried = mdyServerSnapshot(onTheServer, RX);
  const afterRestore = verdicts(mdyRestoreSnapshot(createForm(SCHEMA()), carried, RX));

  assert.deepEqual(afterRestore, inTheBrowser);
});

/**
 * What the sending side itself concluded, in the shape road A reports.
 *
 * Comparing only post-restore verdicts is not enough, and the gap is not hypothetical: a restore
 * recomputes from the values, so a sending side whose rules froze at creation still yields correct
 * verdicts on the receiving side while having rendered wrong ones itself. Measured — the roads agreed
 * while the snapshot carried "Name is required" for a field holding a name.
 */
const carriedVerdicts = (snapshot) =>
  snapshot.fields.map((each) => ({
    path: each.path,
    value: each.value,
    valid: each.verdict === "valid",
    pending: each.pending,
    errors: each.errors,
  }));

test("what the sending side concluded is what the receiving side would", () => {
  // The half the round trip cannot see. A frozen computation is invisible after a restore and plain
  // here, because this reads the verdicts the server would have rendered rather than re-derived ones.
  const inTheBrowser = verdicts(written(createForm(SCHEMA())));
  const carried = mdyServerSnapshot(written(createForm(SCHEMA())), RX);
  assert.deepEqual(carriedVerdicts(carried), inTheBrowser.fields);
});

/**
 * A sending side whose rules stopped re-running the moment the form was built.
 *
 * Planted rather than waited for: it is the defect that motivates the whole path — a runtime whose
 * computations freeze at creation renders a module "valid" with a required field empty — and a
 * runtime that has since been repaired would leave this untested if the check waited to meet one.
 */
const frozenAtCreation = (form) => {
  const stuck = new Map(form.fieldNames().map((path) => {
    const state = form.getField(path)();
    return [path, { valid: state.valid(), errors: state.errors() }];
  }));
  const live = form.getField.bind(form);
  form.getField = (path) => {
    const real = live(path);
    return () => ({
      ...real(),
      valid: () => stuck.get(path).valid,
      errors: () => stuck.get(path).errors,
    });
  };
  return form;
};

test("a sending side whose rules froze at creation is caught", () => {
  // The freeze is applied before the write, which is what a runtime that does not re-run does. A
  // snapshot taken from it carries "Name is required" for a field holding a name.
  const inTheBrowser = verdicts(written(createForm(SCHEMA())));
  const carried = mdyServerSnapshot(written(frozenAtCreation(createForm(SCHEMA()))), RX);

  assert.notDeepEqual(
    carriedVerdicts(carried),
    inTheBrowser.fields,
    "a form whose rules never re-ran produced the same verdicts as one whose rules did, so this run does not compare what it believes",
  );
});

test("a snapshot survives being carried as text", () => {
  // What actually crosses the boundary is a string, and a structure that only round-trips as a live
  // object has not been serialized. `Date` and `undefined` are the two that pass one and fail this.
  const form = written(createForm(SCHEMA()));
  const carried = JSON.parse(JSON.stringify(mdyServerSnapshot(form, RX)));
  assert.deepEqual(verdicts(mdyRestoreSnapshot(createForm(SCHEMA()), carried, RX)), verdicts(form));
});

test("an unrun asynchronous verdict is carried as pending, never as passed", () => {
  // A verdict that has not happened must not serialize as one that has. The server does not wait
  // for the network, so the honest report is "not run" — and a client that reads `valid` here would
  // show a green field the rules have never seen.
  const slow = createForm({
    handle: field("taken", [], {
      asyncValidators: [() => new Promise(() => undefined)],
    }),
  });
  slow.f.handle.set("still-taken");

  const carried = mdyServerSnapshot(slow, RX);
  const handle = carried.fields.find((each) => each.path === "handle");
  assert.equal(handle.pending, true, "an async validator that never settled was not reported pending");
  assert.equal(handle.verdict, "unknown", "a verdict that never ran was serialized as reached");
  assert.equal(carried.verdict, "unknown", "the form claimed a verdict while a rule was still running");
});

test("nothing in a snapshot is taken from the clock", () => {
  // A snapshot carrying a timestamp cannot round-trip to an equal one by construction, so the
  // property this whole file asserts would be untestable rather than false.
  const text = JSON.stringify(mdyServerSnapshot(written(createForm(SCHEMA())), RX));
  const now = String(Date.now()).slice(0, 8);
  assert.doesNotMatch(text, new RegExp(now), "the snapshot carries something clock-shaped");
});

test("a runtime that has not said it can do this is refused, by name", () => {
  // Silence is the failure being replaced: a runtime whose computations freeze would otherwise
  // serialise verdicts that disagree with what a person sees, and nothing would say so.
  const cannot = { ...RX, kind: "frozen-runtime", capabilities: { ...RX.capabilities, serverSnapshots: false } };

  assert.throws(
    () => mdyServerSnapshot(createForm(SCHEMA()), cannot),
    (error) => {
      assert.ok(error instanceof TypeError);
      assert.match(error.message, /serverSnapshots/, "the refusal did not name the flag");
      assert.match(error.message, /frozen-runtime/, "the refusal did not name the runtime");
      return true;
    },
  );

  assert.throws(
    () => mdyRestoreSnapshot(createForm(SCHEMA()), mdyServerSnapshot(createForm(SCHEMA()), RX), cannot),
    /serverSnapshots/,
    "the restoring half accepted a runtime the taking half refused",
  );
});

test("a runtime with no capabilities at all is refused rather than assumed", () => {
  // The matrix distinguishes "declares false" from "has no capabilities object yet". Both are
  // absences of a promise, and neither is a promise.
  assert.throws(
    () => mdyServerSnapshot(createForm(SCHEMA()), { ...RX, kind: "pre-milestone", capabilities: undefined }),
    /serverSnapshots/,
  );
});
