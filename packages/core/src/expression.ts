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
  | "lessThan"
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

/** An operand is a literal, a reference to a field's value, or a nested expression. */
export type MdyOperand = MdyPathRef | string | number | boolean | null | MdyExpression;

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
  "lessThan",
  "matches",
  "and",
  "or",
  "not",
]);

/** Whether `operand` names a field rather than carrying a literal. */
export function isPathRef(operand: MdyOperand): operand is MdyPathRef {
  return typeof operand === "object" && operand !== null && !("op" in operand) && "path" in operand;
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
 * Emptiness as a *form* means it.
 *
 * A whitespace-only string is empty because a user who typed a space has not filled the field in;
 * `0` and `false` are **not** empty, because they are answers.
 */
function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
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

function resolveOperand(operand: MdyOperand | undefined, value: unknown, depth: number): unknown {
  if (operand === undefined || operand === null) return null;
  if (isExpression(operand)) return evaluateAt(operand, value, depth + 1);
  if (isPathRef(operand)) return memberAccess(value, operand.path);
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
export function evaluateExpression(expr: MdyExpression, value: unknown): boolean {
  return evaluateAt(expr, value, 0);
}

function evaluateAt(expr: MdyExpression, value: unknown, depth: number): boolean {
  // Past the bottom the expression is unreadable, which is the case the default already answers:
  // a rule that cannot be read keeps the field visible and invents no error.
  if (depth > MDY_MAX_EXPRESSION_DEPTH) return true;

  const operands = operandsOf(expr);
  const [a, b] = operands;
  const av = (): unknown => resolveOperand(a, value, depth);
  const bv = (): unknown => resolveOperand(b, value, depth);

  switch (expr.op) {
    case "equals":
      return Object.is(av(), bv());
    case "notEquals":
      return !Object.is(av(), bv());
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
    case "greaterThan":
      return (av() as number) > (bv() as number);
    case "lessThan":
      return (av() as number) < (bv() as number);
    case "matches": {
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
      return new RegExp(source).test(String(av() ?? ""));
    }
    case "and":
      return operands.every((operand) => Boolean(resolveOperand(operand, value, depth)));
    case "or":
      return operands.some((operand) => Boolean(resolveOperand(operand, value, depth)));
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
    if (isPathRef(operand) && isReadablePath(operand.path)) paths.add(operand.path);
  };
  for (const operand of operandsOf(expr)) walk(operand, 1);
  return [...paths];
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
    } else if (typeof operand === "object" && operand !== null) {
      problems.push(`${where}.operands[${index}]: an object operand must be {path} or a nested expression`);
    }
  });

  return problems;
}
