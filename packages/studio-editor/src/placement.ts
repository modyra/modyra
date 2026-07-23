/**
 * Drop/placement validation (plan section 7): reject cycle, bad parent/child,
 * max depth, duplicate sibling name, second array item, reserved name,
 * malformed command — *before* any command mutates the project.
 */
import { RESERVED_NAMES } from "@modyra/studio-model";
import type { MdyStudioProject, StudioDiagnostic, StudioIndexes } from "@modyra/studio-model";
import type { Placement } from "./types.js";

export const MAX_DEPTH = 32;

function depthOf(idx: StudioIndexes, nodeId: string): number {
  let depth = 0;
  let current: string | null = idx.parentById.get(nodeId) ?? null;
  while (current) {
    depth++;
    current = idx.parentById.get(current) ?? null;
  }
  return depth;
}

function isDescendantOrSelf(idx: StudioIndexes, ancestorId: string, nodeId: string): boolean {
  let current: string | null = nodeId;
  while (current) {
    if (current === ancestorId) return true;
    current = idx.parentById.get(current) ?? null;
  }
  return false;
}

function resolveContainerId(placement: Placement, idx: StudioIndexes): string | null {
  switch (placement.kind) {
    case "before":
    case "after":
      return idx.parentById.get(placement.targetId) ?? null;
    case "inside":
      return placement.parentId;
    case "arrayItem":
      return placement.arrayId;
  }
}

export function validatePlacement(
  _project: MdyStudioProject,
  idx: StudioIndexes,
  params: { nodeId: string; name: string; placement: Placement },
): StudioDiagnostic[] {
  const diagnostics: StudioDiagnostic[] = [];
  const { nodeId, name, placement } = params;

  if (RESERVED_NAMES.has(name)) {
    diagnostics.push({
      code: "RESERVED_NAME",
      severity: "error",
      message: `"${name}" is a reserved name`,
      nodeId,
    });
    return diagnostics;
  }

  const containerId = resolveContainerId(placement, idx);
  if (!containerId || !idx.nodeById.has(containerId)) {
    diagnostics.push({
      code: "MALFORMED_PLACEMENT",
      severity: "error",
      message: "Placement target does not exist",
      nodeId,
    });
    return diagnostics;
  }
  const containerNode = idx.nodeById.get(containerId)!;

  if (placement.kind === "arrayItem") {
    if (containerNode.node !== "array") {
      diagnostics.push({
        code: "INVALID_PARENT_CHILD",
        severity: "error",
        message: `arrayItem placement target "${containerId}" is not an array node`,
        nodeId,
      });
    } else if (containerNode.item.id !== nodeId && isDescendantOrSelf(idx, nodeId, containerNode.item.id)) {
      // replacing the existing item is allowed; nesting the array under its own current item is not
      diagnostics.push({
        code: "CYCLE",
        severity: "error",
        message: `Placing "${nodeId}" as the item of "${containerId}" would create a cycle`,
        nodeId,
      });
    }
  } else {
    if (containerNode.node !== "group") {
      diagnostics.push({
        code: "INVALID_PARENT_CHILD",
        severity: "error",
        message: `Cannot place a node inside "${containerNode.node}" node "${containerId}"`,
        nodeId,
      });
    } else {
      const siblingIds = idx.childrenByParent.get(containerId) ?? [];
      for (const siblingId of siblingIds) {
        if (siblingId === nodeId) continue;
        const sibling = idx.nodeById.get(siblingId);
        if (sibling && sibling.name === name) {
          diagnostics.push({
            code: "DUPLICATE_SIBLING_NAME",
            severity: "error",
            message: `Sibling name "${name}" already used under "${containerId}"`,
            nodeId,
          });
          break;
        }
      }
    }

    if (isDescendantOrSelf(idx, nodeId, containerId)) {
      diagnostics.push({
        code: "CYCLE",
        severity: "error",
        message: `Placing "${nodeId}" under "${containerId}" would create a cycle`,
        nodeId,
      });
    }
  }

  if (depthOf(idx, containerId) + 1 > MAX_DEPTH) {
    diagnostics.push({
      code: "MAX_DEPTH_EXCEEDED",
      severity: "error",
      message: `Placement exceeds max depth ${MAX_DEPTH}`,
      nodeId,
    });
  }

  return diagnostics;
}

export function validateRename(
  idx: StudioIndexes,
  nodeId: string,
  newName: string,
): StudioDiagnostic[] {
  const diagnostics: StudioDiagnostic[] = [];
  if (RESERVED_NAMES.has(newName)) {
    diagnostics.push({
      code: "RESERVED_NAME",
      severity: "error",
      message: `"${newName}" is a reserved name`,
      nodeId,
    });
    return diagnostics;
  }
  const parentId = idx.parentById.get(nodeId);
  if (parentId) {
    const siblingIds = idx.childrenByParent.get(parentId) ?? [];
    for (const siblingId of siblingIds) {
      if (siblingId === nodeId) continue;
      const sibling = idx.nodeById.get(siblingId);
      if (sibling && sibling.name === newName) {
        diagnostics.push({
          code: "DUPLICATE_SIBLING_NAME",
          severity: "error",
          message: `Sibling name "${newName}" already used under "${parentId}"`,
          nodeId,
        });
        break;
      }
    }
  }
  return diagnostics;
}
