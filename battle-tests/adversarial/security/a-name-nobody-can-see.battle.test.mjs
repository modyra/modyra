/**
 * Two field names that look the same, and a contract that already cares about names colliding.
 *
 * `parseDynamicForm` refuses a duplicate name — `MDY_DYNAMIC_DUPLICATE_NAME` — because two fields
 * under one name is a form that cannot say what it holds. It refuses `__proto__`, `constructor`,
 * `prototype`, an empty segment, a trailing dot and a whitespace-only name, each with its own
 * diagnostic. The care is there, and the reasoning with it.
 *
 * The characters that make two different names *look* identical are not on the list:
 *
 *   "amount"            accepted
 *   "amount​"      accepted — a zero-width space; on screen it is "amount"
 *   "iban‮x"       accepted — a right-to-left override; the rest of the line reads backwards
 *
 * Parsed in **strict** mode: `ok: true`, three fields kept, no diagnostic. The payload then carries
 * two keys a person reading it cannot tell apart:
 *
 *   as printed   "amount"  "amount​"
 *   as seen      amount  |  amount
 *
 * The framework knows this class of character exactly. `security.md` lists it in a table and
 * `sanitize: "text"` strips it from **values** — zero-width `U+200B–200D` and `U+FEFF`, bidi
 * overrides and isolates `U+202A–202E`, `U+2066–2069` — and the guide uses `U+202E` itself to
 * explain why the profile exists: *`"admin‮"` looks like `admin` and is not*. A battle beside this
 * one measures all thirteen being removed from a value.
 *
 * A name is not a value and never meets the sanitizer. It is also the thing a value is filed under:
 * it becomes a path, a payload key, and the label a reviewer reads when checking what a generated
 * document declares.
 *
 * The assertion is the narrow one: **a name the framework's own sanitizer would strip from a value
 * is not accepted as a name.** It does not ask for a new rule — the list exists, in the guide's table
 * and in the profile that implements it.
 */

import { parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** One representative per range the security guide's table names for `"text"`. */
const INVISIBLE = Object.freeze([
  { what: "a zero-width space", char: "​" },
  { what: "a zero-width non-joiner", char: "‌" },
  { what: "a byte-order mark", char: "﻿" },
  { what: "a right-to-left override", char: "‮" },
  { what: "a first-strong isolate", char: "⁨" },
  { what: "a line separator", char: " " },
]);

function parsedWith(name) {
  const parsed = parseDynamicForm(
    { version: 2, fields: [{ name, kind: "text", label: "X" }] },
    { mode: "strict" },
  );
  return { kept: parsed.fields.length > 0, codes: parsed.diagnostics.map((each) => each.code) };
}

battle(
  {
    claims: ["SEC-001", "DYN-004"],
    title: "a name the sanitizer would strip from a value is not accepted as a name",
    environments: ["node"],
  },
  async (ctx) => {
    const observed = INVISIBLE.map((entry) => ({
      what: entry.what,
      ...parsedWith(`amount${entry.char}`),
    }));
    ctx.log.note("a name carrying one invisible character", observed);

    // Two controls. An ordinary name must be kept, or "everything is accepted" would describe a
    // parser that keeps nothing. And the contract must already refuse *some* name, or there would be
    // no rule about names to be inconsistent with.
    const ordinary = parsedWith("amount");
    const reserved = parsedWith("__proto__");
    const duplicate = parseDynamicForm(
      {
        version: 2,
        fields: [
          { name: "amount", kind: "text", label: "A" },
          { name: "amount", kind: "text", label: "B" },
        ],
      },
      { mode: "strict" },
    );
    expectClaim(
      ordinary.kept &&
        ordinary.codes.length === 0 &&
        !reserved.kept &&
        duplicate.diagnostics.some((each) => each.code === "MDY_DYNAMIC_DUPLICATE_NAME"),
      {
        claimIds: ["SEC-001"],
        what: "the parser keeps nothing, or refuses no name at all, so the probe is wrong before the contract is",
        detail: JSON.stringify({ ordinary, reserved, duplicateCodes: duplicate.diagnostics.map((e) => e.code) }),
      },
    );

    expectEqual(
      observed.filter((row) => row.kept && row.codes.length === 0).map((row) => row.what),
      [],
      {
        claimIds: ["SEC-001", "DYN-004"],
        what: "a name carrying a character the framework strips from every value was accepted in strict mode, so two fields can share a name on screen and two keys reach the payload",
      },
    );
  },
);
