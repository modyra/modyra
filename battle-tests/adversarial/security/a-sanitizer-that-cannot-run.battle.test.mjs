/**
 * The per-field sanitizer, and what happens when it cannot do its job.
 *
 * `security.sanitize` is documented as a protection with a stated purpose — `"strict"` *"removes `<`,
 * `>` and backticks so the value can never form markup"* — and a custom function is *"full control;
 * receives the whole field value and returns the sanitized one"*. `setSanitizer(name, fn)` installs
 * one on a single field, and had no battle at all.
 *
 * A function that is full control is a function that can fail. What the engine does then decides
 * whether a broken sanitizer is a defect a consumer finds or one their users carry: the value is kept
 * as it arrived — the protection fails open — and a `sanitizer-error` violation is reported through
 * `onViolation`, the channel the policy already carries.
 *
 * Fail-open is a choice rather than an accident, and this battle holds both halves of it: the value
 * that survives, and the report that makes the survival visible. A change to either is a change to
 * how much a consumer can rely on a sanitizer they wrote.
 *
 * The controls come first: a sanitizer that works is applied and says `sanitized`, and the declared
 * `"strict"` profile strips the markup its documentation names. Without them, a `sanitizer-error`
 * below would be a channel that fires for everything.
 */

import { createForm, field } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const MARKUP = "<script>alert(1)</script>";

/** A form whose violations are collected rather than dropped, which is what the policy is for. */
function formWatching(security = {}) {
  const violations = [];
  const form = createForm({ bio: field("") }, {
    security: { ...security, onViolation: (violation) => violations.push(violation.kind) },
    devWarnings: false,
  });
  return { form, violations };
}

battle(
  {
    claims: ["SEC-002"],
    title: "a sanitizer that cannot run says so, and what it could not clean is not passed off as clean",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: the declared profile does what its documentation says.
    const strict = formWatching({ sanitize: "strict" });
    strict.form.f.bio.set(MARKUP);
    ctx.log.note("the declared strict profile", { value: strict.form.getValue().bio, violations: strict.violations });

    expectClaim(!strict.form.getValue().bio.includes("<") && strict.violations.includes("sanitized"), {
      claimIds: ["SEC-002"],
      what: "the strict profile did not strip markup or did not report doing so",
      detail: () => JSON.stringify({ value: strict.form.getValue().bio, violations: strict.violations }),
    });

    // The second control: a per-field sanitizer that works is applied and reported through the same
    // channel, so the channel is not one that only ever carries errors.
    const working = formWatching();
    working.form.setSanitizer("bio", (value) => String(value).replace(/</g, ""));
    working.form.f.bio.set(MARKUP);
    ctx.log.note("a per-field sanitizer that works", { value: working.form.getValue().bio, violations: working.violations });

    expectClaim(!working.form.getValue().bio.includes("<") && working.violations.includes("sanitized"), {
      claimIds: ["SEC-002"],
      what: "a working per-field sanitizer was not applied, or not reported",
      detail: () => JSON.stringify({ value: working.form.getValue().bio, violations: working.violations }),
    });

    // And the one that cannot run. The value is kept as it arrived — the protection fails open — so
    // the report is the only thing standing between a broken sanitizer and a consumer who thinks
    // they have one.
    const broken = formWatching();
    broken.form.setSanitizer("bio", () => {
      throw new Error("this sanitizer cannot run");
    });
    broken.form.f.bio.set(MARKUP);
    ctx.log.note("a sanitizer that throws", { value: broken.form.getValue().bio, violations: broken.violations });

    expectEqual(broken.form.getValue().bio, MARKUP, {
      claimIds: ["SEC-002"],
      what: "a failing sanitizer changed the value, so what is asserted below is not fail-open",
    });

    expectClaim(broken.violations.includes("sanitizer-error"), {
      claimIds: ["SEC-002"],
      what: "a sanitizer that could not run left the value unprotected without reporting it",
      detail: () => JSON.stringify(broken.violations),
    });

    // The same through the policy door rather than the per-field one, because a consumer reaches
    // this either way and a protection that reports on one path and not the other is worse than one
    // that reports on neither.
    const policy = formWatching({ sanitize: () => { throw new Error("this sanitizer cannot run"); } });
    policy.form.f.bio.set(MARKUP);
    ctx.log.note("a policy-wide sanitizer that throws", { value: policy.form.getValue().bio, violations: policy.violations });

    expectClaim(policy.violations.includes("sanitizer-error"), {
      claimIds: ["SEC-002"],
      what: "a failing policy sanitizer reported nothing, while the per-field one does",
      detail: () => JSON.stringify(policy.violations),
    });

    strict.form.destroy();
    working.form.destroy();
    broken.form.destroy();
    policy.form.destroy();
  },
);
