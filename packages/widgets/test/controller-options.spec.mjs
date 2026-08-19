import assert from "node:assert/strict";
import test from "node:test";

import {
  comparableControllerOptions,
  sameControllerOptions,
  stableControllerOptions,
} from "../dist/index.js";

/**
 * Whether two configurations describe the same controller.
 *
 * A configuration written at the call is a new object every render, so a host that rebuilt its
 * controller on the object's identity rebuilt it every time — a new subscription, a state write, and
 * another render that writes another object. What is compared is what the configuration says.
 */
test("two configurations that say the same thing are the same configuration", () => {
  const options = [{ value: "a", label: "Alpha" }, { value: "b", label: "Beta" }];
  assert.equal(
    sameControllerOptions({ widgetId: "w", options }, { widgetId: "w", options }),
    true,
    "the same list under a fresh wrapper is the same configuration",
  );
  assert.equal(
    sameControllerOptions(
      { widgetId: "w", options: [{ value: "a", label: "Alpha" }] },
      { widgetId: "w", options: [{ value: "a", label: "Alpha" }] },
    ),
    true,
    "an option list written at the call carries fresh objects and says the same thing",
  );
  assert.equal(sameControllerOptions({ widgetId: "w" }, { widgetId: "x" }), false);
  assert.equal(sameControllerOptions({ widgetId: "w" }, { widgetId: "w", searchable: true }), false);
  assert.equal(
    sameControllerOptions({ options: [{ value: "a", label: "Alpha" }] }, { options: [{ value: "a", label: "Alfa" }] }),
    false,
    "a label is part of what a configuration says",
  );
});

/**
 * A handler is not comparable and is not lost.
 *
 * Compared by identity it would defeat the whole comparison — a function written at the call is new
 * every render — so it is left out of the comparison and answered by a stable one that calls
 * whatever the latest render passed.
 */
test("handlers are left out of the comparison and kept current by the stable configuration", () => {
  const withHandler = { widgetId: "w", onChange: () => "first" };
  assert.deepEqual(comparableControllerOptions(withHandler), { widgetId: "w" });
  assert.equal(
    sameControllerOptions(
      comparableControllerOptions({ widgetId: "w", onChange: () => "first" }),
      comparableControllerOptions({ widgetId: "w", onChange: () => "second" }),
    ),
    true,
    "two configurations differing only in a handler's identity say the same thing",
  );

  let latest = { widgetId: "w", onChange: () => "first" };
  const stable = stableControllerOptions(latest, () => latest);
  assert.equal(stable.widgetId, "w");
  assert.equal(stable.onChange(), "first");

  // The controller keeps the function it was built with; the render that follows changes what it
  // calls. A handler captured at build time answers for a render that has passed.
  latest = { widgetId: "w", onChange: () => "second" };
  assert.equal(stable.onChange(), "second");

  // And a configuration a later render stops carrying is answered rather than raising.
  latest = { widgetId: "w" };
  assert.equal(stable.onChange(), undefined);
});
