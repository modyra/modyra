/**
 * Two published fixtures whose documents declare several fields, and a parse that says they declared
 * none.
 *
 * `acceptedCount + rejectedCount` is what a document *declared* — that is the sentence that makes the
 * pair worth reading, because it lets a caller tell "three fields, one refused" from "two fields".
 *
 * A field inside a collection is declared and is not a flat field: a document cannot name rows that
 * do not exist yet, so the flat list legitimately cannot carry it. But it was declared, and the pair
 * is the one place that says so.
 *
 * `spec/fixtures/dynamic-form/v3/nested-collections.json` and `positional-nesting.json` are the
 * project's own documentation of the contract, and every field in them lives inside a collection. The
 * parse answers `accepted 0, rejected 0` — a document that declared nothing.
 *
 * This is the same number as the rejection-with-no-reason finding, from the other side. That one
 * counted a collection as a loss; this one counts its contents as nothing. Between them is the
 * sentence the pair is supposed to satisfy.
 *
 * The fixtures are read from disk rather than written here: a synthetic document proves the parser
 * does it, and the corpus proves the contract's own documentation is one of the documents it happens
 * to.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const FIXTURES = resolve(HERE, "..", "..", "..", "spec", "fixtures", "dynamic-form");

const KINDS = new Set([
  "text", "textarea", "email", "password", "number", "slider", "checkbox", "toggle", "select",
  "radio", "multiselect", "segmented", "datepicker", "daterange", "timepicker", "file", "colors",
]);

/** Every field node a document declares, wherever it lives — the number the pair claims to report. */
function declaredFields(node) {
  if (Array.isArray(node)) return node.reduce((total, each) => total + declaredFields(each), 0);
  if (node === null || typeof node !== "object") return 0;
  const here = node.node === "field" && KINDS.has(node.field?.kind) ? 1 : 0;
  return here + Object.values(node).reduce((total, each) => total + declaredFields(each), 0);
}

const fixture = (version, name) =>
  JSON.parse(readFileSync(join(FIXTURES, version, `${name}.json`), "utf8"));

battle(
  {
    claims: ["DYN-003", "DYN-002"],
    title: "a document declaring fields inside a collection did not declare nothing",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: a published fixture whose fields are not all inside collections reports them. The
    // pair works — what is in question is which fields it counts.
    const flatEnough = fixture("v3", "keyed-rows");
    const flatParse = parseDynamicForm(flatEnough, { mode: "strict" });
    ctx.log.note("a fixture with a field outside its collection", {
      accepted: flatParse.acceptedCount,
      rejected: flatParse.rejectedCount,
    });

    expectClaim(flatParse.ok && flatParse.acceptedCount > 0, {
      claimIds: ["DYN-003"],
      what: "a published fixture with a plain field reported none, so the pair is not reporting anything",
      detail: JSON.stringify({ accepted: flatParse.acceptedCount, rejected: flatParse.rejectedCount }),
    });

    // And the two whose every field lives inside a collection.
    for (const name of ["nested-collections", "positional-nesting"]) {
      const document = fixture("v3", name);
      const parsed = parseDynamicForm(document, { mode: "strict" });
      const declared = declaredFields(document.schema ?? document);
      ctx.log.note("a published fixture built out of collections", {
        name,
        declared,
        accepted: parsed.acceptedCount,
        rejected: parsed.rejectedCount,
        collections: (parsed.collections ?? []).map((each) => each.path),
      });

      // The premise: the document is fine and the parser understood its collections. What is in
      // question is the pair beside them.
      expectClaim(parsed.ok === true && (parsed.collections ?? []).length > 0, {
        claimIds: ["DYN-002"],
        what: `${name} did not parse cleanly with its collections found, so nothing below is about the count`,
        detail: JSON.stringify({ ok: parsed.ok, collections: parsed.collections }),
      });

      expectClaim(declared > 0, {
        claimIds: ["DYN-003"],
        what: `${name} declares no fields at all, so there is nothing for the pair to have missed`,
      });

      expectEqual(parsed.acceptedCount + parsed.rejectedCount, declared, {
        claimIds: ["DYN-003"],
        what: `${name} declares ${declared} field(s) and the parse reports ${parsed.acceptedCount + parsed.rejectedCount} declared`,
        detail: JSON.stringify({
          accepted: parsed.acceptedCount,
          rejected: parsed.rejectedCount,
          declared,
        }),
      });
    }
  },
);
