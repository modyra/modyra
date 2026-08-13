/**
 * A field the form is not asking about paints no verdict — checked in this renderer's own DOM.
 *
 * `verdict.spec.mjs` in `@modyra/widgets` proves the controllers and the projections answer the rule.
 * That is one layer above the pixel: a renderer can consume a correct contract and still toggle an
 * error class of its own beside it, and the four faces of the question — the wrapper class, the
 * label state, `aria-invalid` and whether the error text is in the document — are written in
 * different files here.
 *
 * So every kind is driven into *invalid and then disabled* and the whole surface is read back. The
 * first half of each check is the one that matters: a kind that never showed the error in the first
 * place would pass the second half trivially.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { KINDS, mount } = await import("./support/state-fixture.mjs");

/** Everything in this widget's subtree that says "this field is failing". */
function verdictOf(root) {
  const errorItems = root.querySelectorAll(".mdy-control__errors li, .mdy-control__errors .mdy-control__error");
  return {
    wrapperError: root.querySelectorAll(".mdy-input-wrapper--error").length,
    labelError: root.querySelectorAll(".mdy-label--has-error").length,
    ariaInvalid: root.querySelectorAll('[aria-invalid="true"]').length,
    errorText: [...errorItems].map((n) => n.textContent?.trim()).filter(Boolean),
    describedByError: [...root.querySelectorAll("[aria-describedby]")]
      .map((n) => n.getAttribute("aria-describedby"))
      .filter((v) => v && v.includes("error")).length,
  };
}

function total(v) {
  return v.wrapperError + v.labelError + v.ariaInvalid + v.errorText.length + v.describedByError;
}

for (const kind of KINDS) {
  test(`${kind}: the verdict disappears with the question, and the errors do not`, async () => {
    const fixture = mount(kind);
    try {
      assert.equal(fixture.drive("invalid"), true, `${kind}: cannot be driven invalid`);
      await fixture.settle();
      const failing = verdictOf(fixture.root);
      assert.ok(
        total(failing) > 0,
        `${kind}: shows no verdict even while in play and failing — the check below would prove nothing`,
      );

      assert.equal(fixture.drive("disabled"), true, `${kind}: cannot be driven disabled`);
      await fixture.settle();
      const quiet = verdictOf(fixture.root);

      assert.equal(quiet.wrapperError, 0, `${kind}: wrapper still painted as failing`);
      assert.equal(quiet.labelError, 0, `${kind}: label still painted as failing`);
      assert.equal(quiet.ariaInvalid, 0, `${kind}: still announces aria-invalid`);
      assert.deepEqual(quiet.errorText, [], `${kind}: still renders the error text`);
      assert.equal(quiet.describedByError, 0, `${kind}: still points aria-describedby at the error list`);

      assert.ok(
        fixture.value !== undefined,
        `${kind}: the fixture cannot report the value, so "nothing was lost" is untested`,
      );
    } finally {
      fixture.dispose();
    }
  });
}
