/**
 * A refusal that names a cause the document does not have.
 *
 * The v2 schema states the rule in its own description: a placement slot and a section's per-size
 * placement are "both of which the parser refuses below v3". The parser does refuse them, so the rule
 * holds. What it says while refusing is the question here.
 *
 * The published v3 fixture is the construct in question, written by the people who defined it. Moving
 * its version number to 2 is the whole edit — every field name it references still exists, every one
 * of them still resolves. The parser answers `MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE`, twice, and an
 * author reading that goes looking for a misspelled field name. There is none to find.
 *
 * `MDY_DYNAMIC_UNSUPPORTED_VERSION` is already published in `MDY_DYNAMIC_DIAGNOSTICS` and already
 * fires for a version the parser does not know, so the vocabulary for saying this exists. It is not
 * reached when the version is one the parser knows and the construct is one that version predates.
 *
 * The fixture is read rather than copied, so a change to what v3 demonstrates changes what is asked
 * here.
 *
 * The version is one of two ways in. The second battle here reaches the same answer through the depth
 * limit: nesting sections one past `MDY_LAYOUT_MAX_DEPTH` reports the same code about the same kind of
 * correct reference. Two routes to one message is what makes this the walk's answer for stopping at
 * all rather than a missed case at the version check — whatever ends the walk, the field it never
 * reached is reported as one the document does not have.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { MDY_DYNAMIC_DIAGNOSTICS, MDY_LAYOUT_MAX_DEPTH, parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const REPO = resolve(HERE, "..", "..", "..");
const FIXTURES = join(REPO, "spec", "fixtures", "dynamic-form");

const fixture = (version, name) => JSON.parse(readFileSync(join(FIXTURES, version, name), "utf8"));

battle(
  {
    claims: ["DYN-003", "DYN-001"],
    title: "a construct refused for its version does not blame a field name that is correct",
    environments: ["node"],
  },
  async (ctx) => {
    const published = fixture("v3", "placement.json");
    const names = new Set(published.fields.map((each) => each.name));

    // The control: as published it parses cleanly, so whatever the relabelled copy reports is about
    // the version rather than about the fixture.
    const asPublished = parseDynamicForm(published, { mode: "strict" });
    expectClaim(asPublished.ok && asPublished.diagnostics.length === 0, {
      claimIds: ["DYN-001"],
      what: "the published v3 placement fixture does not parse as v3",
      detail: JSON.stringify(asPublished.diagnostics),
    });

    // Every reference it makes resolves, which is what makes the reported cause untrue rather than
    // merely unhelpful.
    const referenced = [];
    const walk = (child) => {
      if (typeof child === "string") referenced.push(child);
      else if (child?.ref !== undefined) referenced.push(child.ref);
      else for (const each of child?.children ?? child?.columns?.flat() ?? []) walk(each);
    };
    for (const child of published.layout ?? []) walk(child);
    ctx.log.note("what the fixture references", { referenced, declared: [...names] });

    expectEqual(referenced.filter((name) => !names.has(name)), [], {
      claimIds: ["DYN-001"],
      what: "the fixture references a field it does not declare, so an unknown-reference diagnostic would be true",
    });

    // The same document, one number changed.
    const asV2 = parseDynamicForm({ ...published, version: 2 }, { mode: "strict" });
    const codes = asV2.diagnostics.map((each) => each.code);
    ctx.log.note("the same document, relabelled version 2", { ok: asV2.ok, codes });

    // Refusing is correct and the v2 schema says so in its own description. This battle does not ask
    // for it to be accepted.
    expectClaim(asV2.ok === false, {
      claimIds: ["DYN-003"],
      what: "a v3-only construct was accepted under version 2, which the published v2 schema says is refused",
    });

    // The vocabulary for saying why is already published.
    const vocabulary = MDY_DYNAMIC_DIAGNOSTICS.map((each) => each.code);
    expectClaim(vocabulary.includes("MDY_DYNAMIC_UNSUPPORTED_VERSION"), {
      claimIds: ["DYN-003"],
      what: "no published diagnostic code speaks about versions, so there is nothing to report instead",
      detail: JSON.stringify(vocabulary),
    });

    expectClaim(!codes.includes("MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE"), {
      claimIds: ["DYN-003"],
      what: "a construct refused for its version was reported as an unknown field reference, and every reference in it resolves",
      detail: JSON.stringify({ codes, referenced }),
    });
  },
);

battle(
  {
    claims: ["DYN-003", "DYN-001"],
    title: "a layout refused for its depth does not blame the field at the bottom of it",
    environments: ["node"],
  },
  async (ctx) => {
    // Sections nested around the published limit, over a document declaring exactly the field they
    // reference. The reference is correct at every depth; only the nesting changes.
    const nested = (depth) => {
      let node = "a";
      for (let level = 0; level < depth; level += 1) node = { kind: "section", id: `s${level}`, children: [node] };
      return { version: 3, fields: [{ name: "a", kind: "text" }], layout: [node] };
    };

    // The control: at the limit it parses cleanly, so what happens one past it is the limit rather
    // than the shape.
    const atLimit = parseDynamicForm(nested(MDY_LAYOUT_MAX_DEPTH), { mode: "strict" });
    expectClaim(atLimit.ok && atLimit.diagnostics.length === 0, {
      claimIds: ["DYN-001"],
      what: `a layout nested to the published limit of ${MDY_LAYOUT_MAX_DEPTH} was refused`,
      detail: JSON.stringify(atLimit.diagnostics),
    });

    const past = parseDynamicForm(nested(MDY_LAYOUT_MAX_DEPTH + 1), { mode: "strict" });
    const codes = past.diagnostics.map((each) => each.code);
    ctx.log.note("one section past the published limit", { limit: MDY_LAYOUT_MAX_DEPTH, ok: past.ok, codes });

    // Refusing is right — the limit is published, and a walk without one is a document that can stop
    // the parser. This battle does not ask for the layout to be accepted.
    expectClaim(past.ok === false, {
      claimIds: ["DYN-003"],
      what: `a layout nested past ${MDY_LAYOUT_MAX_DEPTH} was accepted, so the published limit is not one`,
    });

    // And it terminates on a document far past it rather than walking as deep as it is given.
    const started = Date.now();
    const absurd = parseDynamicForm(nested(5000), { mode: "lenient" });
    const elapsed = Date.now() - started;
    ctx.log.note("five thousand sections", { ms: elapsed, codes: absurd.diagnostics.map((each) => each.code) });

    expectClaim(elapsed < 1000, {
      claimIds: ["DYN-003"],
      what: `a layout nested 5000 deep took ${elapsed}ms, which a document can choose`,
    });

    expectClaim(!codes.includes("MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE"), {
      claimIds: ["DYN-003"],
      what: "a layout refused for its depth was reported as an unknown field reference, and the field it names is declared in the same document",
      detail: JSON.stringify(codes),
    });
  },
);
