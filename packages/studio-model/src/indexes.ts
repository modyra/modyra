/**
 * Derived index tables (plan section 7). Always rebuilt from the project,
 * never hand-maintained —
 */
import type {
  MdyStudioProject,
  NodeRef,
  StudioExpression,
  StudioOperand,
  StudioSchemaNode,
} from "./types.js";

export interface StudioIndexes {
  nodeById: Map<string, StudioSchemaNode>;
  parentById: Map<string, string | null>;
  childrenByParent: Map<string, string[]>;
  /** Node ID -> its current derived dotted path (root = ""). */
  pathByNode: Map<string, string>;
  /** Derived dotted path -> node ID (excludes array-item template wrappers, which are path-transparent). */
  nodeByPath: Map<string, string>;
  /** Node ID -> IDs of every entity (validator/behavior) that references it by NodeRef. */
  referencesByTargetNode: Map<string, string[]>;
  /** Node ID -> IDs of form/server validators that declare it as a dependency. */
  validatorsByDependency: Map<string, string[]>;
}

function isNodeRef(value: StudioOperand | NodeRef | null | undefined): value is NodeRef {
  return (
    typeof value === "object" &&
    value !== null &&
    "nodeId" in value &&
    typeof (value as NodeRef).nodeId === "string"
  );
}

function collectNodeRefs(expr: StudioExpression | undefined | null): NodeRef[] {
  if (!expr) return [];
  const refs: NodeRef[] = [];
  const visit = (operand: StudioOperand | undefined): void => {
    if (operand === undefined || operand === null) return;
    if (isNodeRef(operand)) {
      refs.push(operand);
      return;
    }
    if (typeof operand === "object" && "op" in operand) {
      visit(operand.operand);
      for (const nested of operand.operands ?? []) visit(nested);
    }
  };
  visit(expr.operand);
  for (const operand of expr.operands ?? []) visit(operand);
  return refs;
}

function addReference(idx: StudioIndexes, nodeId: string, referencerId: string): void {
  const list = idx.referencesByTargetNode.get(nodeId) ?? [];
  if (!list.includes(referencerId)) list.push(referencerId);
  idx.referencesByTargetNode.set(nodeId, list);
}

function addDependency(idx: StudioIndexes, nodeId: string, validatorId: string): void {
  const list = idx.validatorsByDependency.get(nodeId) ?? [];
  if (!list.includes(validatorId)) list.push(validatorId);
  idx.validatorsByDependency.set(nodeId, list);
}

function registerChild(
  idx: StudioIndexes,
  node: StudioSchemaNode,
  parentId: string,
  path: string,
): void {
  idx.nodeById.set(node.id, node);
  idx.parentById.set(node.id, parentId);
  idx.pathByNode.set(node.id, path);
  idx.nodeByPath.set(path, node.id);
  const siblings = idx.childrenByParent.get(parentId) ?? [];
  siblings.push(node.id);
  idx.childrenByParent.set(parentId, siblings);
}

function walk(node: StudioSchemaNode, parentId: string, parentPath: string, idx: StudioIndexes): void {
  const path = parentPath === "" ? node.name : `${parentPath}.${node.name}`;
  registerChild(idx, node, parentId, path);
  descend(node, path, idx);
}

/**
 * A collection's row template is path-transparent: it represents the row shape, not a named field.
 *
 * The row's key or index is chosen while the form runs, so everything under the template shares the
 * collection's own path — which is what makes a template's descendants addressable by the editor
 * without inventing a row that does not exist yet.
 */
function walkRowTemplate(
  node: StudioSchemaNode,
  collectionId: string,
  collectionPath: string,
  idx: StudioIndexes,
): void {
  idx.nodeById.set(node.id, node);
  idx.parentById.set(node.id, collectionId);
  idx.pathByNode.set(node.id, collectionPath);
  const siblings = idx.childrenByParent.get(collectionId) ?? [];
  siblings.push(node.id);
  idx.childrenByParent.set(collectionId, siblings);
  if (node.node === "group") {
    for (const child of node.children) walk(child, node.id, collectionPath, idx);
  } else if (node.node === "array" || node.node === "record") {
    walkRowTemplate(node.item, node.id, collectionPath, idx);
  }
}

function descend(node: StudioSchemaNode, path: string, idx: StudioIndexes): void {
  if (node.node === "group") {
    for (const child of node.children) walk(child, node.id, path, idx);
  } else if (node.node === "array" || node.node === "record") {
    walkRowTemplate(node.item, node.id, path, idx);
  }
}

export function buildIndexes(project: MdyStudioProject): StudioIndexes {
  const idx: StudioIndexes = {
    nodeById: new Map(),
    parentById: new Map(),
    childrenByParent: new Map(),
    pathByNode: new Map(),
    nodeByPath: new Map(),
    referencesByTargetNode: new Map(),
    validatorsByDependency: new Map(),
  };

  const root = project.schema;
  idx.nodeById.set(root.id, root);
  idx.parentById.set(root.id, null);
  idx.pathByNode.set(root.id, "");
  idx.nodeByPath.set("", root.id);
  descend(root, "", idx);

  for (const validator of project.formValidators) {
    for (const dep of validator.dependencies) {
      addReference(idx, dep.nodeId, validator.id);
      addDependency(idx, dep.nodeId, validator.id);
    }
    for (const ref of collectNodeRefs(validator.condition)) {
      addReference(idx, ref.nodeId, validator.id);
    }
    if (validator.errorTarget) addReference(idx, validator.errorTarget.nodeId, validator.id);
  }

  const visitFieldServerValidators = (node: StudioSchemaNode): void => {
    if (node.node === "field" && node.serverValidator) {
      const sv = node.serverValidator;
      for (const dep of sv.dependencies) {
        addReference(idx, dep.nodeId, sv.id);
        addDependency(idx, dep.nodeId, sv.id);
      }
      for (const ref of collectNodeRefs(sv.skipWhen)) addReference(idx, ref.nodeId, sv.id);
    }
    if (node.node === "group") {
      for (const child of node.children) visitFieldServerValidators(child);
    } else if (node.node === "array") {
      visitFieldServerValidators(node.item);
    }
  };
  visitFieldServerValidators(root);

  for (const ref of project.behaviors.draft?.exclude ?? []) {
    addReference(idx, ref.nodeId, "behaviors.draft");
  }

  return idx;
}
