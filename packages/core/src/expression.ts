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
 */

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

function resolveOperand(operand: MdyOperand | undefined, value: unknown): unknown {
  if (operand === undefined || operand === null) return null;
  if (isExpression(operand)) return evaluateExpression(operand, value);
  if (isPathRef(operand)) return memberAccess(value, operand.path);
  return operand;
}

/**
 * Evaluates `expr` against `value`, the whole form value.
 *
 * An unknown operator evaluates to `true`. That is the safe direction for the two things expressions
 * drive: a visibility rule keeps the field visible, and a validation whose condition cannot be read
 * does not fire — an unreadable rule never hides a field or invents an error. Malformed expressions
 * are reported by {@link validateExpression} when the config is parsed, so this is the last resort
 * rather than the only defence.
 */
export function evaluateExpression(expr: MdyExpression, value: unknown): boolean {
  const operands = operandsOf(expr);
  const [a, b] = operands;
  const av = (): unknown => resolveOperand(a, value);
  const bv = (): unknown => resolveOperand(b, value);

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
      return new RegExp(source).test(String(av() ?? ""));
    }
    case "and":
      return operands.every((operand) => Boolean(resolveOperand(operand, value)));
    case "or":
      return operands.some((operand) => Boolean(resolveOperand(operand, value)));
    case "not":
      return !av();
    default:
      return true;
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
  const walk = (operand: MdyOperand | undefined): void => {
    if (operand === undefined || operand === null) return;
    if (isExpression(operand)) {
      for (const nested of operandsOf(operand)) walk(nested);
      return;
    }
    if (isPathRef(operand)) paths.add(operand.path);
  };
  for (const operand of operandsOf(expr)) walk(operand);
  return [...paths];
}

/**
 * Why `expr` is not a usable expression, or `[]` when it is.
 *
 * Expressions arrive from documents, so a malformed one has to be **reported** at parse time rather
 * than surfacing later as a rule that silently never fires.
 */
export function validateExpression(expr: unknown, where: string): readonly string[] {
  if (!isExpression(expr)) return [`${where}: expected an expression object with an "op"`];

  const problems: string[] = [];
  if (!OPS.has(expr.op)) problems.push(`${where}: unknown operator "${String(expr.op)}"`);

  const operands = operandsOf(expr);
  if (operands.length === 0) problems.push(`${where}: "${String(expr.op)}" has no operands`);

  if (expr.op === "matches") {
    const [, pattern] = operands;
    if (typeof pattern !== "string") {
      problems.push(`${where}: "matches" needs a literal string pattern`);
    } else {
      try {
        new RegExp(pattern);
      } catch {
        problems.push(`${where}: "matches" pattern is not a valid regular expression`);
      }
    }
  }

  operands.forEach((operand, index) => {
    if (isExpression(operand)) problems.push(...validateExpression(operand, `${where}.operands[${index}]`));
    else if (typeof operand === "object" && operand !== null && !isPathRef(operand)) {
      problems.push(`${where}.operands[${index}]: an object operand must be {path} or a nested expression`);
    }
  });

  return problems;
}
