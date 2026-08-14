/**
 * Compiles a portable {@link StudioExpression} (ADR-0005) into a JS
 * boolean expression string, evaluated against a form's whole value object
 * at runtime — never `eval`/`new Function` (): this is compile-to-source,
 * the same "IR -> print" step every other target output goes through.
 *
 * Shared by every codegen target that has to turn a Studio form validator's
 * condition into code (Core now; Angular/React targets reuse this
 * unchanged rather than each re-deriving the same semantics).
 */
import type { NodeRef, StudioExpression, StudioOperand } from "@modyra/studio-model";
import { printRegExp, printString } from "./ts-print.js";

/** `value["a"]["b"]` for path `"a.b"`; bare `value` for root's empty-string path — bracket notation sidesteps identifier/reserved-word issues entirely. */
function memberAccess(path: string): string {
  if (!path) return "value";
  return `value${path
    .split(".")
    .map((segment) => `[${JSON.stringify(segment)}]`)
    .join("")}`;
}

function isNodeRef(operand: StudioOperand): operand is NodeRef {
  return typeof operand === "object" && operand !== null && !("op" in operand) && "nodeId" in operand;
}

function isExpression(operand: StudioOperand): operand is StudioExpression {
  return typeof operand === "object" && operand !== null && "op" in operand;
}

function compileOperand(operand: StudioOperand | undefined, pathOf: (nodeId: string) => string, depth: number): string {
  if (operand === undefined || operand === null) return "null";
  if (isExpression(operand)) return compileAt(operand, pathOf, depth + 1);
  if (isNodeRef(operand)) return memberAccess(pathOf(operand.nodeId));
  if (typeof operand === "string") return printString(operand);
  // Printed by kind, never by `String(operand)`. What is left after the branches above is a number,
  // a boolean, or something `StudioOperand` does not describe — and the last case is the whole
  // problem: `String(["globalThis.taken = 1"])` is its own join, so an array operand put an
  // assignment into the emitted expression *unquoted*, in a module a consumer compiles, decided by a
  // project file. An object gave `[object Object]`, which is the same defect failing loudly.
  //
  // Refused rather than coerced. A value outside the type is not a value this can print faithfully,
  // and guessing produces source nobody wrote.
  if (typeof operand === "number") {
    if (!Number.isFinite(operand)) {
      throw new Error(`Expression operand is ${String(operand)}, which is not a value a condition can hold`);
    }
    return String(operand);
  }
  if (typeof operand === "boolean") return String(operand);
  throw new Error(
    `Expression operand is ${Array.isArray(operand) ? "an array" : `a ${typeof operand}`}, which is not one of the ` +
    "kinds a condition may hold: a node reference, a string, a number, a boolean, null, or a nested expression",
  );
}

function isEmptyExpr(target: string): string {
  return `(${target} === null || ${target} === undefined || (typeof ${target} === "string" && ${target}.trim() === "") || (Array.isArray(${target}) && ${target}.length === 0))`;
}

/** Compiles `expr` to a JS boolean expression string. `pathOf` resolves a NodeRef's stable ID to its derived dotted path (root is `""`). */
/**
 * How deep a condition may nest before compiling it is refused.
 *
 * The same bound the contract holds. It is stated here rather than imported because this package
 * generates code from a Studio project and depends on the model alone; the number is part of what
 * the contract will accept, so a condition past it compiles to code no runtime would run anyway.
 */
const MAX_EXPRESSION_DEPTH = 32;

export function compileExpressionToJs(expr: StudioExpression, pathOf: (nodeId: string) => string): string {
  return compileAt(expr, pathOf, 0);
}

function compileAt(expr: StudioExpression, pathOf: (nodeId: string) => string, depth: number): string {
  if (depth > MAX_EXPRESSION_DEPTH) {
    throw new Error(`Expression nests deeper than ${MAX_EXPRESSION_DEPTH} levels`);
  }
  const operands = expr.operands ?? (expr.operand !== undefined ? [expr.operand] : []);
  const [a, b] = operands;

  switch (expr.op) {
    case "equals":
      return `${compileOperand(a, pathOf, depth)} === ${compileOperand(b, pathOf, depth)}`;
    case "notEquals":
      return `${compileOperand(a, pathOf, depth)} !== ${compileOperand(b, pathOf, depth)}`;
    case "isEmpty":
      return isEmptyExpr(compileOperand(a, pathOf, depth));
    case "isNotEmpty":
      return `!${isEmptyExpr(compileOperand(a, pathOf, depth))}`;
    case "lengthAtLeast":
      return `((${compileOperand(a, pathOf, depth)}?.length ?? 0) >= ${compileOperand(b, pathOf, depth)})`;
    case "lengthAtMost":
      return `((${compileOperand(a, pathOf, depth)}?.length ?? 0) <= ${compileOperand(b, pathOf, depth)})`;
    case "greaterThan":
      return `${compileOperand(a, pathOf, depth)} > ${compileOperand(b, pathOf, depth)}`;
    case "lessThan":
      return `${compileOperand(a, pathOf, depth)} < ${compileOperand(b, pathOf, depth)}`;
    case "matches": {
      const pattern = typeof b === "string" ? b : "";
      return `${printRegExp(pattern)}.test(${compileOperand(a, pathOf, depth)})`;
    }
    case "and":
      return operands.length
        ? `(${operands.map((o) => compileOperand(o, pathOf, depth)).join(" && ")})`
        : "true";
    case "or":
      return operands.length
        ? `(${operands.map((o) => compileOperand(o, pathOf, depth)).join(" || ")})`
        : "false";
    case "not":
      return `!(${compileOperand(a, pathOf, depth)})`;
    default:
      return "true";
  }
}
