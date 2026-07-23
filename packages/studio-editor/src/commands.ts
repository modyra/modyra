/**
 * Invertible commands over MdyStudioProject (plan section 7; ADR
 * .modyra/studio/adr/0003-command-engine.md): insert, move, delete,
 * duplicate, updateNode, add/remove field validator, updateBehavior,
 * add/remove form validator.
 *
 * An array's `item` template cannot be moved/deleted directly (the type
 * requires exactly one item; there is no valid "empty" intermediate state).
 * Replace it via `insertNode` targeting an `arrayItem` placement instead.
 */
import { buildIndexes, createId } from "@modyra/studio-model";
import type {
  ArrayNode,
  GroupNode,
  MdyStudioProject,
  StudioDiagnostic,
  StudioFieldValidator,
  StudioFormValidator,
  StudioSchemaNode,
} from "@modyra/studio-model";
import { validatePlacement, validateRename } from "./placement.js";
import type { Command, Placement } from "./types.js";

type Slot = { kind: "child"; parent: GroupNode; index: number } | { kind: "item"; parent: ArrayNode };

/** Only `name`/`label`/`description` are shared across every node kind (see the union-`Omit` note below). */
type NodePatch = Partial<Omit<StudioSchemaNode, "id" | "node" | "children" | "item">>;

function findNode(root: StudioSchemaNode, id: string): StudioSchemaNode | null {
  if (root.id === id) return root;
  if (root.node === "group") {
    for (const child of root.children) {
      const found = findNode(child, id);
      if (found) return found;
    }
  } else if (root.node === "array") {
    return findNode(root.item, id);
  }
  return null;
}

function slotOf(root: StudioSchemaNode, id: string): Slot | null {
  if (root.node === "group") {
    for (let i = 0; i < root.children.length; i++) {
      const child = root.children[i]!;
      if (child.id === id) return { kind: "child", parent: root, index: i };
      const nested = slotOf(child, id);
      if (nested) return nested;
    }
  } else if (root.node === "array") {
    if (root.item.id === id) return { kind: "item", parent: root };
    return slotOf(root.item, id);
  }
  return null;
}

function insert(root: StudioSchemaNode, node: StudioSchemaNode, placement: Placement): void {
  if (placement.kind === "inside") {
    const parent = findNode(root, placement.parentId);
    if (!parent || parent.node !== "group") {
      throw new Error(`insert: "inside" target "${placement.parentId}" is not a group node`);
    }
    const index = Math.max(0, Math.min(placement.index, parent.children.length));
    parent.children.splice(index, 0, node);
    return;
  }
  if (placement.kind === "before" || placement.kind === "after") {
    const slot = slotOf(root, placement.targetId);
    if (!slot || slot.kind !== "child") {
      throw new Error(`insert: "${placement.kind}" target "${placement.targetId}" has no group parent`);
    }
    slot.parent.children.splice(slot.index + (placement.kind === "after" ? 1 : 0), 0, node);
    return;
  }
  const array = findNode(root, placement.arrayId);
  if (!array || array.node !== "array") {
    throw new Error(`insert: "arrayItem" target "${placement.arrayId}" is not an array node`);
  }
  if (node.node === "array") {
    throw new Error("insert: an array's item cannot itself be an array");
  }
  array.item = node;
}

function placementAfterSibling(parent: GroupNode, index: number): Placement {
  return index === 0
    ? { kind: "inside", parentId: parent.id, index: 0 }
    : { kind: "after", targetId: parent.children[index - 1]!.id };
}

function collectIds(node: StudioSchemaNode, out: string[] = []): string[] {
  out.push(node.id);
  if (node.node === "group") node.children.forEach((c) => collectIds(c, out));
  else if (node.node === "array") collectIds(node.item, out);
  return out;
}

function cloneWithFreshIds(node: StudioSchemaNode): StudioSchemaNode {
  const copy = structuredClone(node);
  const visit = (n: StudioSchemaNode): void => {
    n.id = createId("nd");
    if (n.node === "field") {
      for (const validator of n.validators) validator.id = createId("val");
      if (n.serverValidator) n.serverValidator.id = createId("val");
    } else if (n.node === "array") {
      n.validators.forEach((v) => (v.id = createId("val")));
      visit(n.item);
    } else {
      n.children.forEach(visit);
    }
  };
  visit(copy);
  return copy;
}

function error(code: string, message: string, nodeId?: string): StudioDiagnostic[] {
  return [{ code, severity: "error", message, ...(nodeId ? { nodeId } : {}) }];
}

/** Merges `patch` into `target`, treating an explicit `undefined` value as "delete this key". */
function applyPatch<T extends Record<string, unknown>>(target: T, patch: Partial<T>): void {
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete target[key as keyof T];
    else target[key as keyof T] = value as T[keyof T];
  }
}

/** Captures the pre-patch values of `patch`'s keys from `source`, `undefined` if the key wasn't present. */
function capturePatch<T extends Record<string, unknown>>(source: T, patch: Partial<T>): Partial<T> {
  const original: Partial<T> = {};
  for (const key of Object.keys(patch) as (keyof T)[]) {
    original[key] = key in source ? source[key] : undefined;
  }
  return original;
}

export function inspectDelete(
  project: MdyStudioProject,
  nodeId: string,
): { requiresConfirmation: boolean; descendantIds: string[]; referencedBy: string[] } {
  const idx = buildIndexes(project);
  const node = idx.nodeById.get(nodeId);
  const descendantIds = node ? collectIds(node).slice(1) : [];
  const referencedBy = [...(idx.referencesByTargetNode.get(nodeId) ?? [])];
  for (const id of descendantIds) referencedBy.push(...(idx.referencesByTargetNode.get(id) ?? []));
  return {
    requiresConfirmation: descendantIds.length > 0 || referencedBy.length > 0,
    descendantIds,
    referencedBy: [...new Set(referencedBy)],
  };
}

export function createInsertCommand(node: StudioSchemaNode, placement: Placement): Command {
  return {
    kind: "insert",
    description: `Insert ${node.name}`,
    affectedIds: collectIds(node),
    validate(project: MdyStudioProject): StudioDiagnostic[] {
      const idx = buildIndexes(project);
      if (idx.nodeById.has(node.id)) return error("DUPLICATE_ID", `Node ID ${node.id} already exists`, node.id);
      return validatePlacement(project, idx, { nodeId: node.id, name: node.name, placement });
    },
    apply(project: MdyStudioProject): MdyStudioProject {
      const copy = structuredClone(project);
      insert(copy.schema, structuredClone(node), placement);
      return copy;
    },
    inverse(before: MdyStudioProject): Command {
      if (placement.kind === "arrayItem") {
        // Inserting as arrayItem *replaces* the array's item; the true inverse is restoring the old one.
        const array = findNode(before.schema, placement.arrayId);
        if (!array || array.node !== "array") throw new Error(`insert.inverse: array "${placement.arrayId}" missing`);
        return createInsertCommand(structuredClone(array.item), placement);
      }
      return createDeleteCommand(node.id, true);
    },
  };
}

export function createDeleteCommand(nodeId: string, confirmed = false): Command {
  return {
    kind: "delete",
    description: `Delete ${nodeId}`,
    affectedIds: [nodeId],
    validate(project: MdyStudioProject): StudioDiagnostic[] {
      if (nodeId === project.schema.id) return error("MALFORMED_COMMAND", "Cannot delete root", nodeId);
      const slot = slotOf(project.schema, nodeId);
      if (!slot) return error("MALFORMED_COMMAND", "Node does not exist", nodeId);
      if (slot.kind === "item") {
        return error("MALFORMED_COMMAND", "Replace the array item or delete its array", nodeId);
      }
      if (inspectDelete(project, nodeId).requiresConfirmation && !confirmed) {
        return error("CONFIRM_DELETE", "Node has children or references and requires confirmation", nodeId);
      }
      return [];
    },
    apply(project: MdyStudioProject): MdyStudioProject {
      const copy = structuredClone(project);
      const slot = slotOf(copy.schema, nodeId);
      if (!slot || slot.kind !== "child") throw new Error(`delete: node "${nodeId}" is not deletable`);
      slot.parent.children.splice(slot.index, 1);
      return copy;
    },
    inverse(before: MdyStudioProject): Command {
      const slot = slotOf(before.schema, nodeId);
      if (!slot || slot.kind !== "child") throw new Error(`delete.inverse: node "${nodeId}" missing`);
      const node = structuredClone(slot.parent.children[slot.index]!);
      return createInsertCommand(node, placementAfterSibling(slot.parent, slot.index));
    },
  };
}

export function createMoveCommand(nodeId: string, placement: Placement): Command {
  return {
    kind: "move",
    description: `Move ${nodeId}`,
    affectedIds: [nodeId],
    validate(project: MdyStudioProject): StudioDiagnostic[] {
      if (nodeId === project.schema.id) return error("MALFORMED_COMMAND", "Cannot move root", nodeId);
      const slot = slotOf(project.schema, nodeId);
      if (!slot || slot.kind === "item") return error("MALFORMED_COMMAND", "Node is not movable", nodeId);
      const idx = buildIndexes(project);
      const node = idx.nodeById.get(nodeId)!;
      return validatePlacement(project, idx, { nodeId, name: node.name, placement });
    },
    apply(project: MdyStudioProject): MdyStudioProject {
      const copy = structuredClone(project);
      const source = slotOf(copy.schema, nodeId);
      if (!source || source.kind !== "child") throw new Error(`move: node "${nodeId}" is not movable`);
      const [node] = source.parent.children.splice(source.index, 1);
      // Same-parent "inside" placement uses an absolute pre-removal index; shift it after the splice.
      let target = placement;
      if (placement.kind === "inside" && placement.parentId === source.parent.id && placement.index > source.index) {
        target = { ...placement, index: placement.index - 1 };
      }
      insert(copy.schema, node!, target);
      return copy;
    },
    inverse(before: MdyStudioProject): Command {
      const slot = slotOf(before.schema, nodeId);
      if (!slot || slot.kind !== "child") throw new Error(`move.inverse: node "${nodeId}" missing`);
      return createMoveCommand(nodeId, placementAfterSibling(slot.parent, slot.index));
    },
  };
}

export function createDuplicateCommand(nodeId: string, placement?: Placement): Command {
  // Computed once (lazily, on first validate()/apply() call) and cached — NOT recomputed on
  // every validate() call, so repeated validation (e.g. a preview UI) doesn't silently swap
  // out which cloned node id apply()/inverse() end up agreeing on.
  let duplicate: StudioSchemaNode | null = null;
  const ensureDuplicate = (source: StudioSchemaNode): StudioSchemaNode => {
    if (!duplicate) {
      duplicate = cloneWithFreshIds(source);
      duplicate.name = `${duplicate.name}Copy`;
    }
    return duplicate;
  };

  return {
    kind: "duplicate",
    description: `Duplicate ${nodeId}`,
    affectedIds: [nodeId],
    validate(project: MdyStudioProject): StudioDiagnostic[] {
      const slot = slotOf(project.schema, nodeId);
      if (!slot || slot.kind !== "child") return error("MALFORMED_COMMAND", "Node is not duplicable", nodeId);
      const candidate = ensureDuplicate(slot.parent.children[slot.index]!);
      const target = placement ?? { kind: "inside" as const, parentId: slot.parent.id, index: slot.index + 1 };
      return validatePlacement(project, buildIndexes(project), { nodeId: candidate.id, name: candidate.name, placement: target });
    },
    apply(project: MdyStudioProject): MdyStudioProject {
      const slot = slotOf(project.schema, nodeId);
      if (!slot || slot.kind !== "child") throw new Error(`duplicate: node "${nodeId}" missing`);
      const candidate = ensureDuplicate(slot.parent.children[slot.index]!);
      const target = placement ?? { kind: "inside" as const, parentId: slot.parent.id, index: slot.index + 1 };
      const copy = structuredClone(project);
      insert(copy.schema, structuredClone(candidate), target);
      return copy;
    },
    inverse(): Command {
      if (!duplicate) throw new Error("duplicate.inverse: called before validate()/apply()");
      return createDeleteCommand(duplicate.id, true);
    },
  };
}

export function createUpdateNodeCommand(nodeId: string, patch: NodePatch): Command {
  return {
    kind: "updateNode",
    description: `Update ${nodeId}`,
    affectedIds: [nodeId],
    validate(project: MdyStudioProject): StudioDiagnostic[] {
      const idx = buildIndexes(project);
      if (!idx.nodeById.has(nodeId)) return error("MALFORMED_COMMAND", "Node does not exist", nodeId);
      return patch.name === undefined ? [] : validateRename(idx, nodeId, patch.name);
    },
    apply(project: MdyStudioProject): MdyStudioProject {
      const copy = structuredClone(project);
      const node = findNode(copy.schema, nodeId);
      if (!node) throw new Error(`updateNode: node "${nodeId}" missing`);
      applyPatch(node as unknown as Record<string, unknown>, patch);
      return copy;
    },
    inverse(before: MdyStudioProject): Command {
      const node = findNode(before.schema, nodeId);
      if (!node) throw new Error(`updateNode.inverse: node "${nodeId}" missing`);
      const original = capturePatch(node as unknown as Record<string, unknown>, patch);
      return createUpdateNodeCommand(nodeId, original as NodePatch);
    },
  };
}

export function createAddValidatorCommand(nodeId: string, validator: StudioFieldValidator): Command {
  return {
    kind: "addValidator",
    description: `Add ${validator.kind}`,
    affectedIds: [nodeId, validator.id],
    validate(project: MdyStudioProject): StudioDiagnostic[] {
      const node = buildIndexes(project).nodeById.get(nodeId);
      if (!node || node.node !== "field") return error("INVALID_VALIDATOR_TARGET", "Validator target must be a field", nodeId);
      if (node.validators.some((v) => v.id === validator.id)) return error("DUPLICATE_ID", "Validator ID exists", nodeId);
      return [];
    },
    apply(project: MdyStudioProject): MdyStudioProject {
      const copy = structuredClone(project);
      const node = findNode(copy.schema, nodeId);
      if (!node || node.node !== "field") throw new Error(`addValidator: field "${nodeId}" missing`);
      node.validators.push(structuredClone(validator));
      return copy;
    },
    inverse(): Command {
      return createRemoveValidatorCommand(nodeId, validator.id);
    },
  };
}

export function createRemoveValidatorCommand(nodeId: string, validatorId: string): Command {
  return {
    kind: "removeValidator",
    description: `Remove ${validatorId}`,
    affectedIds: [nodeId, validatorId],
    validate(project: MdyStudioProject): StudioDiagnostic[] {
      const node = buildIndexes(project).nodeById.get(nodeId);
      if (!node || node.node !== "field" || !node.validators.some((v) => v.id === validatorId)) {
        return error("MALFORMED_COMMAND", "Validator does not exist", nodeId);
      }
      return [];
    },
    apply(project: MdyStudioProject): MdyStudioProject {
      const copy = structuredClone(project);
      const node = findNode(copy.schema, nodeId);
      if (!node || node.node !== "field") throw new Error(`removeValidator: field "${nodeId}" missing`);
      node.validators.splice(
        node.validators.findIndex((v) => v.id === validatorId),
        1,
      );
      return copy;
    },
    inverse(before: MdyStudioProject): Command {
      const node = findNode(before.schema, nodeId);
      if (!node || node.node !== "field") throw new Error(`removeValidator.inverse: field "${nodeId}" missing`);
      const validator = node.validators.find((v) => v.id === validatorId)!;
      return createAddValidatorCommand(nodeId, structuredClone(validator));
    },
  };
}

export function createUpdateBehaviorCommand(patch: Partial<MdyStudioProject["behaviors"]>): Command {
  return {
    kind: "updateBehavior",
    description: "Update form behavior",
    affectedIds: [],
    validate(): StudioDiagnostic[] {
      return [];
    },
    apply(project: MdyStudioProject): MdyStudioProject {
      const copy = structuredClone(project);
      applyPatch(copy.behaviors as unknown as Record<string, unknown>, structuredClone(patch));
      return copy;
    },
    inverse(before: MdyStudioProject): Command {
      const original = capturePatch(before.behaviors as unknown as Record<string, unknown>, patch);
      return createUpdateBehaviorCommand(original as MdyStudioProject["behaviors"]);
    },
  };
}

export function createAddFormValidatorCommand(validator: StudioFormValidator): Command {
  return {
    kind: "addFormValidator",
    description: `Add form validator ${validator.id}`,
    affectedIds: [validator.id],
    validate(project: MdyStudioProject): StudioDiagnostic[] {
      return project.formValidators.some((v) => v.id === validator.id) ? error("DUPLICATE_ID", "Validator ID exists") : [];
    },
    apply(project: MdyStudioProject): MdyStudioProject {
      const copy = structuredClone(project);
      copy.formValidators.push(structuredClone(validator));
      return copy;
    },
    inverse(): Command {
      return createRemoveFormValidatorCommand(validator);
    },
  };
}

function createRemoveFormValidatorCommand(validator: StudioFormValidator): Command {
  return {
    kind: "removeFormValidator",
    description: `Remove ${validator.id}`,
    affectedIds: [validator.id],
    validate(): StudioDiagnostic[] {
      return [];
    },
    apply(project: MdyStudioProject): MdyStudioProject {
      const copy = structuredClone(project);
      copy.formValidators = copy.formValidators.filter((v) => v.id !== validator.id);
      return copy;
    },
    inverse(): Command {
      return createAddFormValidatorCommand(validator);
    },
  };
}
