/**
 * A portable predicate over a form's value.
 *
 * The rule predicate in {@link MdyDynamicRule} is flat — one field, one operator, one value — which
 * is enough to show or hide a field and nothing more. An expression is a tree, so it can say
 * "shipping is required when the country is not IT **and** the total is over 100", and it addresses
 * fields by **path**, the same way every other part of the dynamic contract does.
 *
 * It is deliberately not executable code. A form arrives as data — from a config file, a generator,
 * a visual builder — and evaluating arbitrary source from such a document is a remote-code-execution
 * hole. Every operator here is a closed, enumerated case; there is no `eval`, no `new Function`, and
 * no operator that can reach outside the value it is given.
 *
 * A path in an expression is untrusted for the same reason a field name is, and passes the same
 * guard: a document that asks about `constructor` is asking about the prototype behind the form
 * rather than about a field, and every answer it gets is one the form's data did not give.
 */
import { isSafeFieldPath } from "./path-utils.js";
import { dynamicPatternRefusal } from "./dynamic/pattern-cost.js";

/**
 * True for a path an expression may read: a field path, or `""` for the root value itself.
 *
 * The root is the one reference `isSafeFieldPath` refuses and this contract has always allowed —
 * a form-level rule reads the whole object.
 */
function isReadablePath(path: string): boolean {
  return path === "" || isSafeFieldPath(path);
}

/** The closed set of operators an expression may use. */
export type MdyExpressionOp =
  | "equals"
  | "notEquals"
  | "isEmpty"
  | "isNotEmpty"
  | "lengthAtLeast"
  | "lengthAtMost"
  | "greaterThan"
  | "greaterThanOrEqual"
  | "lessThan"
  | "lessThanOrEqual"
  | "in"
  | "notIn"
  | "matches"
  | "and"
  | "or"
  | "not";

/**
 * A reference to another field's current value, by dotted path from the form root.
 *
 * `""` is the root value itself, which is how a form-level rule reads the whole object.
 */
export interface MdyPathRef {
  readonly path: string;
}

/**
 * The value of the field the clause is written on.
 *
 * A path names a field from the root, which a clause written once for the item of a collection
 * cannot use: the row has no name until a person creates it. `{ self: true }` is how a condition
 * says *this* value, wherever the clause ends up.
 */
export interface MdySelfRef {
  readonly self: true;
}

/**
 * The whole form value.
 *
 * An expression is evaluated against what encloses the clause, which inside a collection row is the
 * row. `{ root: true }` is how a row-level condition reaches back out to the form it belongs to.
 */
export interface MdyRootRef {
  readonly root: true;
}

/**
 * A fact the host application supplies — a role, a tenant, today's date, a feature flag.
 *
 * It is an API between the application and whoever authors documents for it: the host supplies its
 * context once for the application, and a document declares the keys it reads, so a document naming
 * a key nobody supplies is answerable before anything is painted.
 */
export interface MdyContextRef {
  readonly context: string;
}

/** An operand is a literal, a reference to a value, or a nested expression. */
export type MdyOperand =
  | MdyPathRef
  | MdySelfRef
  | MdyRootRef
  | MdyContextRef
  | string
  | number
  | boolean
  | null
  | MdyExpression;

/**
 * What an expression is read against, beyond the value it is evaluated on.
 *
 * Every member is optional because a caller may have none of them — a rule evaluated against a form
 * value alone, which is every caller before this existed. A reference to something the scope does
 * not carry does not resolve to nothing: the expression holding it answers `false`, so a condition
 * that cannot be read never opens what it guards.
 */
export interface MdyExpressionScope {
  /** The value of the field the clause is written on, for `{ self: true }`. */
  readonly self?: unknown;
  /** The whole form value, for `{ root: true }`. */
  readonly root?: unknown;
  /** The facts the host supplies, for `{ context: "key" }`. */
  readonly context?: Readonly<Record<string, unknown>>;
}

/**
 * A predicate tree.
 *
 * `operand` and `operands` are both accepted because unary operators read better with the singular
 * and `and`/`or` need the plural; `operands` wins when both are present.
 */
export interface MdyExpression {
  readonly op: MdyExpressionOp;
  readonly operand?: MdyOperand;
  readonly operands?: readonly MdyOperand[];
}

const OPS: ReadonlySet<string> = new Set<MdyExpressionOp>([
  "equals",
  "notEquals",
  "isEmpty",
  "isNotEmpty",
  "lengthAtLeast",
  "lengthAtMost",
  "greaterThan",
  "greaterThanOrEqual",
  "lessThan",
  "lessThanOrEqual",
  "in",
  "notIn",
  "matches",
  "and",
  "or",
  "not",
]);

/** Whether `operand` names a field rather than carrying a literal. */
export function isPathRef(operand: MdyOperand): operand is MdyPathRef {
  // The member has to *be* a path, not merely be there. `{ path: 4 }` answered true here and then
  // took the read down inside `memberAccess`, where a number has no `split` — a malformed reference
  // becoming an exception in the middle of reading a form.
  return typeof operand === "object" && operand !== null && !("op" in operand)
    && typeof (operand as MdyPathRef).path === "string";
}

/** Whether `operand` names the value of the field the clause is written on. */
export function isSelfRef(operand: MdyOperand): operand is MdySelfRef {
  return typeof operand === "object" && operand !== null && !("op" in operand) && (operand as MdySelfRef).self === true;
}

/** Whether `operand` names the whole form value. */
export function isRootRef(operand: MdyOperand): operand is MdyRootRef {
  return typeof operand === "object" && operand !== null && !("op" in operand) && (operand as MdyRootRef).root === true;
}

/** Whether `operand` names a fact the host supplies. */
export function isContextRef(operand: MdyOperand): operand is MdyContextRef {
  return typeof operand === "object" && operand !== null && !("op" in operand)
    && typeof (operand as MdyContextRef).context === "string";
}

/** Whether `operand` is itself a predicate to evaluate first. */
export function isExpression(operand: unknown): operand is MdyExpression {
  return typeof operand === "object" && operand !== null && "op" in operand;
}

/** The operands of `expr`, however it spelled them. */
function operandsOf(expr: MdyExpression): readonly MdyOperand[] {
  return expr.operands ?? (expr.operand !== undefined ? [expr.operand] : []);
}

/**
 * Reads `path` out of `value`.
 *
 * Returns `undefined` rather than throwing when the path runs off the end of the object, because a
 * predicate over a partially filled form asks about fields that do not exist yet all the time — that
 * is the normal case, not an error.
 */
function memberAccess(value: unknown, path: string): unknown {
  if (!path) return value;
  return path.split(".").reduce<unknown>((accumulator, segment) => {
    if (accumulator === null || accumulator === undefined || typeof accumulator !== "object") return undefined;
    // Own properties only: a form's value is data, and a member it inherits is not an answer the
    // form gave. Without this an empty form answers `isNotEmpty` about `constructor` with true, and
    // a document chooses which branch applies by naming something no field ever declared.
    if (!Object.hasOwn(accumulator as object, segment)) return undefined;
    return (accumulator as Record<string, unknown>)[segment];
  }, value);
}

/**
 * Emptiness as a *form* means it: the value a field holds when nobody has answered it.
 *
 * Read from what each kind's value contract calls its empty rather than from what a JavaScript
 * value looks like. A whitespace-only string is empty because a user who typed a space has not
 * filled the field in. `false` is empty because a checkbox's contract says absence is not one of its
 * values, so "not ticked" is the only way that field can say *nothing yet* — and `required` already
 * refuses it, which is the same question asked in the other spelling. An object every member of
 * which is empty is empty, which is what a `daterange` holds before either end is picked.
 *
 * `0` stays an answer, and that is the agreement rather than the exception: a slider's thumb is
 * always somewhere, so an untouched slider reads as filled — and `required` says the same, which is
 * why the two halves agree there and had to be made to agree everywhere else.
 */
function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "boolean") return value === false;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") {
    const members = Object.values(value as Record<string, unknown>);
    return members.every((member) => isEmptyValue(member));
  }
  return false;
}

/**
 * How deep a predicate tree may nest.
 *
 * An expression arrives from a document, and recursion over one is bounded for the same reason the
 * schema is bounded at 8 levels and the layout at 6: a document deep enough to exhaust the call
 * stack would take the host down instead of being reported, and it need not be large to do it — a
 * few tens of kilobytes of `and` nest past what JavaScript itself will walk. A tree written by a
 * person or a model is a handful of levels; thirty-two is well past that and well short of the
 * stack.
 *
 * The bound also settles a shape JSON cannot express but an object graph can: a cycle meets the
 * bottom rather than spinning.
 */
export const MDY_MAX_EXPRESSION_DEPTH = 32;

/**
 * How long a pattern inside a condition may be.
 *
 * The same cap a document's `validators.pattern` carries. A condition is read every time the form is
 * read, so length matters here for the same reason cost does.
 */
export const MDY_MAX_EXPRESSION_PATTERN_LENGTH = 256;

/**
 * How many operands each operator needs to mean anything.
 *
 * Declared beside the operators rather than inferred: `isEmpty` reads one, `equals` compares two,
 * and `and` joins as many as it is given but not none. An expression short of them is unreadable
 * even though its operator is spelled correctly.
 */
const ARITY_OF: Readonly<Record<MdyExpressionOp, number>> = Object.freeze({
  equals: 2,
  notEquals: 2,
  isEmpty: 1,
  isNotEmpty: 1,
  lengthAtLeast: 2,
  lengthAtMost: 2,
  greaterThan: 2,
  greaterThanOrEqual: 2,
  lessThan: 2,
  lessThanOrEqual: 2,
  in: 2,
  notIn: 2,
  matches: 2,
  and: 1,
  or: 1,
  not: 1,
});

/**
 * What a reference resolves to when the scope does not carry it.
 *
 * Not `undefined` and not `null`: both are values a form holds, so a missing `{ self: true }`
 * answering `undefined` would make `isEmpty` true and open whatever it guards. An expression
 * holding one of these answers `false` instead, which is the direction that keeps a field out of
 * play rather than putting it in.
 */
const UNAVAILABLE = Symbol("modyra:operand-unavailable");

/** The member names an operand uses to say it is a reference rather than a value. */
const REFERENCE_KEYS = ["path", "self", "root", "context"] as const;

/**
 * Whether this operand meant to be a reference and is not one.
 *
 * Reached only after every well-formed shape has been recognised, so anything here that names one of
 * the four is a reference somebody wrote wrongly — a `context` that is a number, a `self` that is a
 * string. Everything else is a literal and stays one.
 */
function claimsToBeAReference(operand: MdyOperand): boolean {
  if (typeof operand !== "object" || operand === null || Array.isArray(operand)) return false;
  return REFERENCE_KEYS.some((key) => Object.hasOwn(operand, key));
}

/** One member of an `and`/`or`: an operand nobody can read is not a member that holds. */
function truthyOperand(
  operand: MdyOperand,
  value: unknown,
  depth: number,
  scope: MdyExpressionScope | undefined,
): boolean {
  const resolved = resolveOperand(operand, value, depth, scope);
  return resolved !== UNAVAILABLE && Boolean(resolved);
}

function resolveOperand(
  operand: MdyOperand | undefined,
  value: unknown,
  depth: number,
  scope: MdyExpressionScope | undefined,
): unknown {
  if (operand === undefined || operand === null) return null;
  if (isExpression(operand)) return evaluateAt(operand, value, depth + 1, scope);
  if (isPathRef(operand)) return memberAccess(value, operand.path);
  // The three that read something other than the value the expression is evaluated against. A
  // caller with no scope has none of them, and a caller with a scope may still be missing one — a
  // document naming a context key the host does not supply is the case the contract refuses before
  // anything is painted, and this is what that refusal rests on.
  if (isSelfRef(operand)) return scope !== undefined && "self" in scope ? scope.self : UNAVAILABLE;
  if (isRootRef(operand)) return scope !== undefined && "root" in scope ? scope.root : UNAVAILABLE;
  if (isContextRef(operand)) {
    const context = scope?.context;
    if (context === undefined || !Object.hasOwn(context, operand.context)) return UNAVAILABLE;
    // The bag is the application's, not the engine's: in a real app it is a store, a signal or a
    // Proxy, so reading a key is a property access that can throw. A condition is read every time
    // the form is read, so a throw here is not a slow form, it is a form that does not paint and a
    // submit that raises.
    try {
      return context[operand.context];
    } catch {
      return UNAVAILABLE;
    }
  }
  // An object that claims to be a reference and is not a well-formed one. `{ context: 123 }`,
  // `{ self: "yes" }`, `{ path: 4 }` reach the literal branch below and are compared as the objects
  // they are — never empty, never equal to anything — so `isNotEmpty` answered true and a section
  // governed by a misspelled operand was shown to everyone. The same answer an unknown *operator*
  // gets, for the same reason: a question with no reading is not answered with the one that opens.
  //
  // Only names that claim it. An object with none of them is a legitimate literal — an option's
  // value may be an object (ADR 0051), and a membership list is an array — so the rule is about a
  // reference written wrongly, not about objects.
  if (claimsToBeAReference(operand)) return UNAVAILABLE;
  return operand;
}

/**
 * Evaluates `expr` against `value`, the whole form value.
 *
 * An operator nobody declared evaluates to `false`, and so does a pattern too costly to run. A
 * question with no answer is not answered with the one that opens: a section governed by a
 * misspelled operator was shown to everyone, and the values inside it went into the payload.
 *
 * Malformed expressions are reported by {@link validateExpression} when a document is parsed, so
 * this is the last resort rather than the only defence — but the two halves have to agree, and the
 * half that *decides* is this one.
 */
export function evaluateExpression(
  expr: MdyExpression,
  value: unknown,
  /**
   * What `{ self }`, `{ root }` and `{ context }` read. Omitted, none of them is available and an
   * expression naming one answers `false` — which is what every caller written before they existed
   * gets, unchanged.
   */
  scope?: MdyExpressionScope,
): boolean {
  return evaluateAt(expr, value, 0, scope);
}

function evaluateAt(
  expr: MdyExpression,
  value: unknown,
  depth: number,
  scope?: MdyExpressionScope,
): boolean {
  // Not an expression at all — `null`, a bare string, an object with no `op`. Reading an operand off
  // one raised from inside the submit a person had just pressed, which is the failure answering
  // `false` to an unknown operator exists to avoid: a document defect must not become a form that
  // cannot be rendered or a button that throws.
  if (!isExpression(expr)) return false;
  // Past the bottom, and deliberately *not* the same answer an unknown operator gets. The depth cap
  // is a limit on what a document may carry, not on what a caller may evaluate: an expression built
  // in code and nested deeper than a document may be is still readable, and cutting it to `false`
  // would make this function refuse work nobody asked it to police.
  if (depth > MDY_MAX_EXPRESSION_DEPTH) return true;

  const operands = operandsOf(expr);
  // An operator can be one of the twelve and the expression still be unreadable: `equals` with
  // nothing to compare, `and` with nothing to join, `not` with nothing to negate.
  // `validateExpression` counts them; the evaluator answered anyway, and answered in the direction
  // that opens.
  if (operands.length < ARITY_OF[expr.op as MdyExpressionOp]) return false;
  const [a, b] = operands;
  // Resolved before the operator runs, because an operand nobody can read is not a value to compare:
  // whichever way the operator would answer, the honest answer is that the question was not asked.
  // `and`/`or` are the exception — they hold whole expressions, each of which answers for itself.
  if (expr.op !== "and" && expr.op !== "or" && expr.op !== "not") {
    for (const operand of operands) {
      if (resolveOperand(operand, value, depth, scope) === UNAVAILABLE) return false;
    }
  }
  const av = (): unknown => resolveOperand(a, value, depth, scope);
  const bv = (): unknown => resolveOperand(b, value, depth, scope);

  switch (expr.op) {
    case "equals":
      return sameValue(av(), bv());
    case "notEquals":
      return !sameValue(av(), bv());
    case "isEmpty":
      return isEmptyValue(av());
    case "isNotEmpty":
      return !isEmptyValue(av());
    case "lengthAtLeast": {
      const target = av() as { length?: number } | null | undefined;
      return (target?.length ?? 0) >= (bv() as number);
    }
    case "lengthAtMost": {
      const target = av() as { length?: number } | null | undefined;
      return (target?.length ?? 0) <= (bv() as number);
    }
    // The four comparisons and the two membership tests answer here exactly as they answer for a
    // rule: one vocabulary, so a document writing `in` means the same thing whichever of the two
    // shapes it writes it in. They arrived in the flat rule predicate first and the tree did not
    // know them, which left four operators a document could write and nothing published could
    // check.
    case "greaterThan":
      return orderedComparison(av(), bv(), (order) => order > 0);
    case "greaterThanOrEqual":
      return orderedComparison(av(), bv(), (order) => order >= 0);
    case "lessThan":
      return orderedComparison(av(), bv(), (order) => order < 0);
    case "lessThanOrEqual":
      return orderedComparison(av(), bv(), (order) => order <= 0);
    case "in":
      return membership(av(), bv());
    case "notIn":
      return !membership(av(), bv());
    case "matches": {
      // A pattern that does not compile raised from here, through whatever read the form last — the
      // submit button included. It decides nothing instead.
      // The pattern must be a literal. Allowing a field's value here would let a form's *data*
      // choose the regular expression, which is how a catastrophically backtracking pattern gets in.
      const source = typeof b === "string" ? b : "";
      // And the same cost gate a document's `validators.pattern` passes (ADR 0050). A condition is
      // the other door a pattern arrives through, and it is read every time the form is read — so a
      // shape that backtracks exponentially does not make a slow form, it makes one that stops
      // answering between two keystrokes. A pattern that cannot be afforded decides nothing.
      if (source.length > MDY_MAX_EXPRESSION_PATTERN_LENGTH || dynamicPatternRefusal(source) !== null) {
        return false;
      }
      try {
        return new RegExp(source).test(String(av() ?? ""));
      } catch {
        return false;
      }
    }
    case "and":
      return operands.every((operand) => truthyOperand(operand, value, depth, scope));
    case "or":
      return operands.some((operand) => truthyOperand(operand, value, depth, scope));
    case "not":
      return !av();
    default:
      // An operator nobody declared is a question with no answer, and the answer to a question with
      // no answer is not the one that opens: a section governed by a misspelled operator was shown
      // to everyone and its values went into the payload. `validateExpression` refuses the same
      // spelling by name — this is the half that decides while the other half reports.
      return false;
  }
}

/**
 * Every field path an expression reads.
 *
 * A cross-field validator has to declare what it depends on, or it will not re-run when the field it
 * asks about changes. Deriving that from the expression removes the chance of the two disagreeing.
 */
/**
 * Equality as a form means it: SameValueZero, the comparison `Array.prototype.includes` and `Map`
 * keys already use.
 *
 * The vocabulary is one vocabulary, and it had three answers for one comparison. The tree's
 * `equals` was `Object.is`, the flat rule's was `===`, and both spellings of `in` were
 * SameValueZero, which agrees with neither: `NaN` equalled `NaN` in three of the four doors and
 * `-0` equalled `0` in two. Neither value is exotic — a number field holding text it cannot read
 * *is* `NaN`, which the engine documents, and `-0` is what a minus in front of a zero parses to —
 * and a `rules` entry with effect `hidden` decides whether a field is in play, so two authors
 * writing the same condition in the two slots the contract offers got opposite answers about
 * whether a value reaches the payload.
 *
 * SameValueZero is the reading that fits a form: `NaN` equals `NaN`, because the field either holds
 * something unreadable or it does not and that is the only way to say so in a condition; `-0`
 * equals `0`, because they are the same answer to the question the form asked.
 */
function sameValue(left: unknown, right: unknown): boolean {
  return left === right || (Number.isNaN(left as number) && Number.isNaN(right as number));
}

/**
 * Answers a rule's condition — the flat predicate a document's `rules` slot carries.
 *
 * Flat rather than a tree: one field, one operator, one value. `MdyDynamicRule` declares ten
 * operators and this is where each is answered, in the module that already owns "what a predicate
 * says about a form's value" — so the tree and the flat form cannot come to disagree about what
 * `isEmpty` means.
 *
 * An operator nobody declared answers `false`, as an expression's does: a question with no answer is
 * not answered with the one that opens the field.
 *
 * Comparisons are between two numbers or two strings. A string comparison is what makes a date rule
 * work — the contract's dates are ISO, and ISO sorts — and anything else is not ordered, so a
 * comparison against it is `false` rather than a coercion nobody asked for.
 */
export function evaluateRuleCondition(
  when: { readonly field: string; readonly operator: string; readonly value?: unknown },
  value: unknown,
): boolean {
  const held = memberAccess(value, when.field);
  const expected = when.value;
  switch (when.operator) {
    case "equals": return sameValue(held, expected);
    case "notEquals": return !sameValue(held, expected);
    // A pair, and complements: `notIn` is exactly `in` negated. Answering `false` to both when the
    // list is not one made the careful spelling — the negative, written to be safe — give the same
    // answer as the positive. A document cannot reach this: the parser refuses a membership test
    // whose value is not a list.
    case "in": return Array.isArray(expected) && expected.includes(held);
    case "notIn": return !(Array.isArray(expected) && expected.includes(held));
    case "isEmpty": return isEmptyValue(held);
    case "isNotEmpty": return !isEmptyValue(held);
    case "greaterThan": return compareOrdered(held, expected, (order) => order > 0);
    case "greaterThanOrEqual": return compareOrdered(held, expected, (order) => order >= 0);
    case "lessThan": return compareOrdered(held, expected, (order) => order < 0);
    case "lessThanOrEqual": return compareOrdered(held, expected, (order) => order <= 0);
    default: return false;
  }
}

/** Membership of a list, and nothing else: a test against something that is not one has no members. */
function membership(held: unknown, expected: unknown): boolean {
  return Array.isArray(expected) && expected.includes(held);
}

/** Two numbers or two strings, or no order at all. */
function orderedComparison(held: unknown, expected: unknown, accept: (order: number) => boolean): boolean {
  return compareOrdered(held, expected, accept);
}

/** Two numbers or two strings, or no order at all. */
function compareOrdered(held: unknown, expected: unknown, accept: (order: number) => boolean): boolean {
  if (typeof held === "number" && typeof expected === "number") {
    if (Number.isNaN(held) || Number.isNaN(expected)) return false;
    return accept(held < expected ? -1 : held > expected ? 1 : 0);
  }
  if (typeof held === "string" && typeof expected === "string") {
    // Two calendar dates are compared as dates. Text order agrees with calendar order only while
    // every part is zero-padded, and that is a property of the *spelling*: `"2026-2-01"` sorts
    // before `"2026-1-10"` because `"2"` sorts after `"1"` and the padding is what hides it. A
    // document cannot reach this — the parser refuses an unpadded date on a date field — but this
    // function is published on its own, and a caller comparing a date out of their own model has no
    // parser in between.
    const left = calendarDate(held);
    const right = calendarDate(expected);
    if (left !== null && right !== null) return accept(left < right ? -1 : left > right ? 1 : 0);
    return accept(held < expected ? -1 : held > expected ? 1 : 0);
  }
  return false;
}

/** A `yyyy-M-d` date as a sortable number, or `null` when the string is not a date at all. */
function calendarDate(value: string): number | null {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const numbers = [Number(year), Number(month), Number(day)] as const;
  if (numbers[1] < 1 || numbers[1] > 12 || numbers[2] < 1 || numbers[2] > 31) return null;
  return numbers[0] * 10_000 + numbers[1] * 100 + numbers[2];
}

export function expressionPaths(expr: MdyExpression): readonly string[] {
  const paths = new Set<string>();
  const walk = (operand: MdyOperand | undefined, depth: number): void => {
    if (operand === undefined || operand === null) return;
    // An expression past the bottom is one `validateExpression` refuses, so what it reads is not a
    // dependency any rule will have.
    if (depth > MDY_MAX_EXPRESSION_DEPTH) return;
    if (isExpression(operand)) {
      for (const nested of operandsOf(operand)) walk(nested, depth + 1);
      return;
    }
    // A path the engine will not register is not a dependency; `validateExpression` refuses the
    // document that carries one, so nothing downstream has to subscribe to it.
    //
    // `{self}`, `{root}` and `{context}` are not paths and never appear here. The first two are read
    // from what encloses the clause, which the caller already re-reads when it changes; the third is
    // supplied by the host once for the application and is not a field at all.
    if (isPathRef(operand) && isReadablePath(operand.path)) paths.add(operand.path);
  };
  for (const operand of operandsOf(expr)) walk(operand, 1);
  return [...paths];
}

/**
 * The context keys `expr` reads, so a host can be asked for them before a form is built.
 *
 * A document declaring a key nobody supplies is answerable at parse time rather than as a condition
 * that quietly never fires: the keys are an API between the application and whoever authors
 * documents for it, and this is the half a reader can check.
 */
export function expressionContextKeys(expr: MdyExpression): readonly string[] {
  const keys = new Set<string>();
  const walk = (operand: MdyOperand | undefined, depth: number): void => {
    if (operand === undefined || operand === null) return;
    if (depth > MDY_MAX_EXPRESSION_DEPTH) return;
    if (isExpression(operand)) {
      for (const nested of operandsOf(operand)) walk(nested, depth + 1);
      return;
    }
    if (isContextRef(operand) && operand.context.length > 0) keys.add(operand.context);
  };
  for (const operand of operandsOf(expr)) walk(operand, 1);
  return [...keys];
}

/**
 * Why `expr` is not a usable expression, or `[]` when it is.
 *
 * Expressions arrive from documents, so a malformed one has to be **reported** at parse time rather
 * than surfacing later as a rule that silently never fires.
 */
export function validateExpression(expr: unknown, where: string): readonly string[] {
  return validateAt(expr, where, 0);
}

function validateAt(expr: unknown, where: string, depth: number): readonly string[] {
  if (!isExpression(expr)) return [`${where}: expected an expression object with an "op"`];
  if (depth > MDY_MAX_EXPRESSION_DEPTH) {
    return [`${where}: nests deeper than ${MDY_MAX_EXPRESSION_DEPTH} levels`];
  }

  const problems: string[] = [];
  if (!OPS.has(expr.op)) problems.push(`${where}: unknown operator "${String(expr.op)}"`);

  const operands = operandsOf(expr);
  if (operands.length === 0) problems.push(`${where}: "${String(expr.op)}" has no operands`);

  if (expr.op === "matches") {
    const [, pattern] = operands;
    if (typeof pattern !== "string") {
      problems.push(`${where}: "matches" needs a literal string pattern`);
    } else if (pattern.length > MDY_MAX_EXPRESSION_PATTERN_LENGTH) {
      problems.push(
        `${where}: "matches" pattern is longer than ${MDY_MAX_EXPRESSION_PATTERN_LENGTH} characters`,
      );
    } else {
      try {
        new RegExp(pattern);
      } catch {
        problems.push(`${where}: "matches" pattern is not a valid regular expression`);
      }
      // The cost gate a document's `validators.pattern` passes (ADR 0050), on the other door a
      // pattern arrives through. A condition is read every time the form is read, so a shape that
      // backtracks exponentially stops the form answering rather than merely slowing it.
      const refusal = dynamicPatternRefusal(pattern);
      if (refusal !== null) problems.push(`${where}: "matches" pattern ${refusal}`);
    }
  }

  operands.forEach((operand, index) => {
    if (isExpression(operand)) problems.push(...validateAt(operand, `${where}.operands[${index}]`, depth + 1));
    else if (isPathRef(operand)) {
      if (!isReadablePath(operand.path)) {
        problems.push(`${where}.operands[${index}]: "${operand.path}" is not a field path`);
      }
    } else if (isSelfRef(operand) || isRootRef(operand)) {
      // Nothing to check: they name one thing each, and whether it is available is a question about
      // the caller rather than about the expression.
    } else if (isContextRef(operand)) {
      if (operand.context.length === 0) {
        problems.push(`${where}.operands[${index}]: a context key cannot be empty`);
      }
    } else if (typeof operand === "object" && operand !== null) {
      problems.push(
        `${where}.operands[${index}]: an object operand must be {path}, {self}, {root}, {context} ` +
        "or a nested expression",
      );
    }
  });

  return problems;
}
