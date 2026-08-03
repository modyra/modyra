/**
 * Translating Studio's expression tree into the contract's.
 *
 * The two trees have the same operators and the same shape; they differ in **how they name a
 * field**. Studio addresses nodes by a stable id that survives a rename, which is what an editor
 * needs and what nothing outside Studio can resolve. The contract addresses fields by the dotted
 * path they occupy in the form value, which is what a form can actually read.
 *
 * So this is the boundary where an id becomes a path. It exists once, here, because the alternative
 * — teaching the contract about node ids — would put a Studio concept in a public schema that
 * renderers and generated code also consume.
 */
import type { MdyExpression, MdyOperand } from "@modyra/core";
import type { StudioExpression, StudioOperand } from "@modyra/studio-model";

/** A node id that no longer resolves, meaning the expression refers to a deleted field. */
export class UnresolvedNodeError extends Error {
  constructor(readonly nodeId: string) {
    super(`Expression references node "${nodeId}", which is not in the schema`);
    this.name = "UnresolvedNodeError";
  }
}

function isStudioExpression(operand: StudioOperand): operand is StudioExpression {
  return typeof operand === "object" && operand !== null && "op" in operand;
}

function isNodeRef(operand: StudioOperand): operand is { nodeId: string } {
  return typeof operand === "object" && operand !== null && !("op" in operand) && "nodeId" in operand;
}

function translateOperand(operand: StudioOperand, pathByNode: ReadonlyMap<string, string>): MdyOperand {
  if (isStudioExpression(operand)) return toContractExpression(operand, pathByNode);
  if (isNodeRef(operand)) {
    const path = pathByNode.get(operand.nodeId);
    // A node id with no path is a reference to something deleted. Compiling it to a path that
    // happens to read `undefined` would produce a condition that silently never fires; the caller
    // turns this into a diagnostic instead.
    if (path === undefined) throw new UnresolvedNodeError(operand.nodeId);
    return { path };
  }
  return operand;
}

/**
 * Rewrites `expr` with every node reference replaced by its path.
 *
 * Throws {@link UnresolvedNodeError} when a referenced node is not in `pathByNode`.
 */
export function toContractExpression(
  expr: StudioExpression,
  pathByNode: ReadonlyMap<string, string>,
): MdyExpression {
  const operands = expr.operands ?? (expr.operand !== undefined ? [expr.operand] : []);
  return {
    op: expr.op,
    operands: operands.map((operand) => translateOperand(operand, pathByNode)),
  };
}
