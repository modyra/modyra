/**
 * The rules a field declares by name, and the validators they build.
 *
 * `field("", [required(), minLength(3)])` says the same thing as
 * `field("", [], { rules: { required: true, minLength: 3 } })`. The first is composition and stays
 * the way to write anything; the second is what most fields actually need, without the imports.
 *
 * The vocabulary is **derived from the validators themselves**, never listed here. Each rule that
 * wants a name declares one — `withFacts(fn, facts, { rule, takes })` — and this reads the
 * declarations off the functions. A list written here would be a second place to be right: a rule
 * added tomorrow would work in code and be silently unavailable to a document, and nothing would
 * say so.
 */
import {
  declarationOf,
  type MdyValidatorDeclaration,
} from "./validator-facts.js";
import type { ValidatorFn } from "./types.js";
import {
  email,
  integer,
  max,
  maxLength,
  min,
  minLength,
  pattern,
  required,
} from "./validators.js";

/**
 * Every validator that offers itself to a document, by the name it declares.
 *
 * Built by asking each function, so a rule whose declaration is removed disappears from here with
 * it, and one that never had a declaration — `oneOf`, whose declarative form is a field's `options`
 * — never appears.
 */
const DECLARED: ReadonlyMap<string, {
  readonly declaration: MdyValidatorDeclaration;
  readonly build: (...args: readonly unknown[]) => ValidatorFn<never>;
}> = (() => {
  const candidates: ReadonlyArray<(...args: never[]) => ValidatorFn<never>> = [
    required as never, email as never, integer as never,
    minLength as never, maxLength as never, min as never, max as never, pattern as never,
  ];
  const found = new Map<string, {
    declaration: MdyValidatorDeclaration;
    build: (...args: readonly unknown[]) => ValidatorFn<never>;
  }>();
  for (const build of candidates) {
    // Built once with placeholder arguments purely to read what it declares: the declaration lives
    // on the validator a factory returns, because that is the thing the engine ends up holding.
    const probe = (build as (...args: unknown[]) => ValidatorFn<never>)(1, undefined);
    const declaration = declarationOf(probe);
    if (declaration) {
      found.set(declaration.rule, {
        declaration,
        build: build as (...args: readonly unknown[]) => ValidatorFn<never>,
      });
    }
  }
  return found;
})();

/** The rule names a document may use, in the order the vocabulary declares them. */
export function declaredRuleNames(): readonly string[] {
  return [...DECLARED.keys()];
}

/** What a rule expects a document to supply for it. `undefined` for a name no rule declares. */
export function declaredRuleShape(rule: string): MdyValidatorDeclaration | undefined {
  return DECLARED.get(rule)?.declaration;
}

/**
 * The rules a field declares, by name.
 *
 * A rule taking nothing is turned on with `true`; one taking a value is given it. The types stay
 * loose on purpose — this is the shape a JSON document also arrives in, and narrowing it here would
 * make the typed door and the declarative one two different vocabularies again.
 */
export type MdyDeclaredRules = Readonly<Record<string, unknown>>;

/** What a declared rule was refused for, in the words the author can act on. */
export interface MdyRuleRefusal {
  readonly rule: string;
  readonly because: string;
}

/**
 * Turn declared rules into validators, refusing what cannot be built rather than guessing.
 *
 * A name nothing declares is refused by name — including one that exists as a function and chose
 * not to offer itself, which is a different sentence from "no such rule" and the more useful one.
 */
export function buildDeclaredRules(rules: MdyDeclaredRules): {
  readonly validators: ReadonlyArray<ValidatorFn<never>>;
  readonly refusals: readonly MdyRuleRefusal[];
} {
  const validators: ValidatorFn<never>[] = [];
  const refusals: MdyRuleRefusal[] = [];

  for (const [rule, given] of Object.entries(rules)) {
    const known = DECLARED.get(rule);
    if (!known) {
      refusals.push({
        rule,
        because: `no validator declares the name "${rule}". Declarable rules: ${declaredRuleNames().join(", ")}`,
      });
      continue;
    }
    const { takes } = known.declaration;
    if (takes.length === 0) {
      // `false` is how a document turns a rule off, and turning one off is the same as not asking
      // for it. Refusing it would make `{ required: someCondition }` unwritable.
      if (given === true) validators.push(known.build());
      else if (given !== false) {
        refusals.push({ rule, because: `"${rule}" takes nothing, so it is turned on with true or off with false` });
      }
      continue;
    }
    const args = takes.length === 1 ? [given] : Array.isArray(given) ? given : [given];
    if (args.length !== takes.length) {
      refusals.push({ rule, because: `"${rule}" takes ${takes.length} value(s) and was given ${args.length}` });
      continue;
    }
    const wrong = takes.findIndex((expected, at) => !matches(expected, args[at]));
    if (wrong >= 0) {
      refusals.push({
        rule,
        because: `"${rule}" expects ${takes[wrong]} for argument ${wrong + 1}, and was given ${describe(args[wrong])}`,
      });
      continue;
    }
    validators.push(known.build(...args));
  }

  return { validators, refusals };
}

function matches(expected: MdyValidatorDeclaration["takes"][number], given: unknown): boolean {
  if (expected === "number") return typeof given === "number" && Number.isFinite(given);
  if (expected === "string") return typeof given === "string";
  // A pattern arrives as a RegExp from code and as its source from a document; both are a pattern.
  return given instanceof RegExp || typeof given === "string";
}

function describe(given: unknown): string {
  if (given === null) return "null";
  if (given instanceof RegExp) return "a RegExp";
  return typeof given;
}
