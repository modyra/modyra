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
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { MDY_DYNAMIC_DIAGNOSTICS, parseDynamicForm } from "@modyra/core";

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
