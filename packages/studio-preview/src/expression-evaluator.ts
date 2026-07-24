/**
 * Direct interpreter for a portable {@link StudioExpression} (ADR-0005) —
 * the live-preview sibling of studio-codegen's `compileExpressionToJs`.
 * Same op semantics, but evaluated immediately against a real form value
 * instead of compiled to source text (no `eval`/`new Function` either way,
 * R11 — this one just skips the "print as source" step since preview has
 * no source file to print into).
 */
import type { NodeRef, StudioExpression, StudioOperand } from "@modyra/studio-model";

function isNodeRef(operand: StudioOperand): operand is NodeRef {
  return typeof operand === "object" && operand !== null && !("op" in operand) && "nodeId" in operand;
}

function isExpression(operand: StudioOperand): operand is StudioExpression {
  return typeof operand === "object" && operand !== null && "op" in operand;
}

function resolveOperand(operand: StudioOperand | undefined, value: unknown, pathOf: (nodeId: string) => string): unknown {
  if (operand === undefined || operand === null) return null;
  if (isExpression(operand)) return evaluateExpression(operand, value, pathOf);
  if (isNodeRef(operand)) return memberAccess(value, pathOf(operand.nodeId));
  return operand;
}

function memberAccess(value: unknown, path: string): unknown {
  if (!path) return value;
  return path.split(".").reduce<unknown>((acc, segment) => {
    if (acc === null || acc === undefined || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[segment];
  }, value);
}

function isEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

/** Evaluates `expr` against `value` (the whole form value). `pathOf` resolves a NodeRef's stable ID to its derived dotted path (root is `""`). */
export function evaluateExpression(expr: StudioExpression, value: unknown, pathOf: (nodeId: string) => string): boolean {
  const operands = expr.operands ?? (expr.operand !== undefined ? [expr.operand] : []);
  const [a, b] = operands;
  const av = () => resolveOperand(a, value, pathOf);
  const bv = () => resolveOperand(b, value, pathOf);

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
      const pattern = typeof b === "string" ? b : "";
      return new RegExp(pattern).test(String(av() ?? ""));
    }
    case "and":
      return operands.every((o) => Boolean(resolveOperand(o, value, pathOf)));
    case "or":
      return operands.some((o) => Boolean(resolveOperand(o, value, pathOf)));
    case "not":
      return !av();
    default:
      return true;
  }
}
