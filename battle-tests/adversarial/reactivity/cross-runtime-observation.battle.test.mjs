/**
 * Observing a handle through a runtime that does not own it.
 *
 * A binding is handed a handle and has to decide which reactivity runtime to read it through. Every
 * consumer that faced this question answered it the same wrong way — build a fresh
 * `vanillaReactivity()` — which works by accident, because vanilla's tracking is global to the
 * module, and stops working the moment the handle belongs to another adapter's form. Nothing
 * re-renders and nothing complains.
 *
 * `observerFor` is the answer: it reads the owner from the registry, honours a runtime passed in
 * explicitly rather than replacing it, and names the mismatch instead of hiding it. That is only
 * true of a handle the registry knows. A handle it does not know takes the fallback — a fresh
 * vanilla runtime — and the mismatch that the diagnostic exists to report passes in silence.
 *
 * So the attack is not "does the diagnostic work". It is: which of the handles a consumer can
 * actually hold does it work for. A form hands out several, and they do not agree.
 */

import {
  array,
  createForm,
  field,
  getFieldHandleOwner,
  group,
  observerFor,
  record,
  vanillaReactivity,
} from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

const SHAPE = {
  name: field(""),
  rows: record(group({ code: field("") })),
  items: array(group({ sku: field("") })),
};

/** Every handle a consumer can reach through the public surface, named as a consumer would say it. */
function handlesOf(form) {
  return [
    ["form.f.name", form.f.name],
    ["form.getField(\"name\")", form.getField("name")],
    ["form.f.rows", form.f.rows],
    ["form.f.rows.row(\"a\")", form.f.rows.row("a")],
    ["form.f.rows.cell(\"a\", \"code\")", form.f.rows.cell("a", "code")],
    ["form.f.items", form.f.items],
    ["form.f.items.at(0)", form.f.items.at(0)],
    ["form.f.items.at(0).sku", form.f.items.at(0).sku],
  ].filter(([, handle]) => handle !== null && handle !== undefined);
}

function openForm(rx) {
  const form = createForm(SHAPE, { reactivity: rx, devWarnings: false });
  form.f.rows.upsert("a", { code: "A" });
  form.f.items.push({ sku: "S" });
  return form;
}

battle(
  {
    claims: ["REA-001"],
    title: "every handle a form hands out is observed through the runtime that owns it",
    environments: ["node"],
  },
  async (ctx) => {
    const owner = vanillaReactivity();
    const form = openForm(owner);

    try {
      // Every shape is measured before anything is asserted: which handles the registry knows is
      // the finding, and a battle that stopped at the first one would report a single name where
      // the answer is a list.
      const strangers = [];
      for (const [name, handle] of handlesOf(form)) {
        ctx.log.note("handle offered by the public surface", { handle: name });

        // Asked without a runtime, `observerFor` answers with the owner or falls back to a fresh
        // vanilla instance. The fallback is indistinguishable from an answer at the call site, which
        // is what makes an untagged handle dangerous rather than merely unsupported.
        if (observerFor(handle) !== owner) strangers.push(name);
      }

      expectClaim(strangers.length === 0, {
        claimIds: ["REA-001"],
        what: "every handle is observed through the runtime that built it",
        detail: `observed through a runtime nobody asked for: ${strangers.join(", ")}`,
      });
    } finally {
      form.destroy();
    }
  },
);

battle(
  {
    claims: ["REA-002"],
    title: "a foreign runtime is named, whichever handle it is used on",
    environments: ["node"],
  },
  async (ctx) => {
    const owner = vanillaReactivity();
    const foreign = vanillaReactivity();
    const form = openForm(owner);

    try {
      const silent = [];
      const overridden = [];
      for (const [name, handle] of handlesOf(form)) {
        const reported = [];
        const returned = observerFor(handle, foreign, { report: (entry) => reported.push(entry) });
        ctx.log.note("foreign runtime offered for a handle", { handle: name });

        if (returned !== foreign) overridden.push(name);
        if (!reported.some((entry) => entry.code === "MDY_CROSS_RUNTIME_OBSERVATION")) silent.push(name);
      }

      // The requested runtime is honoured either way — overriding it would hide the mistake rather
      // than report it — so the diagnostic is the only thing that tells a consumer.
      expectClaim(overridden.length === 0, {
        claimIds: ["REA-002"],
        what: "a handle keeps the runtime the caller asked for",
        detail: `replaced the caller's runtime for: ${overridden.join(", ")}`,
      });

      expectClaim(silent.length === 0, {
        claimIds: ["REA-002"],
        what: "a foreign runtime is named, whichever handle it is used on",
        detail: `mismatch passed in silence for: ${silent.join(", ")}`,
      });
    } finally {
      form.destroy();
    }
  },
);

battle(
  {
    claims: ["REA-002"],
    title: "a runtime that does own the handle is not accused",
    environments: ["node"],
  },
  async (ctx) => {
    const owner = vanillaReactivity();
    const form = openForm(owner);

    try {
      const accused = [];
      for (const [name, handle] of handlesOf(form)) {
        const reported = [];
        observerFor(handle, owner, { report: (entry) => reported.push(entry) });
        ctx.log.note("owning runtime offered for a handle", { handle: name });
        if (reported.length > 0) accused.push(name);
      }

      // The positive control. A diagnostic that fires for the correct runtime too would be noise,
      // and a consumer that learns to ignore it loses the one that matters.
      expectClaim(accused.length === 0, {
        claimIds: ["REA-002"],
        what: "a runtime that does own the handle is not accused",
        detail: `reported a mismatch against their own runtime: ${accused.join(", ")}`,
      });
    } finally {
      form.destroy();
    }
  },
);
