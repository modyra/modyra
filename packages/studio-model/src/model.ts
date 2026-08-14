/**
 * Model services (plan section 5 "Required services"): normalize, validate/
 * diagnose, serialize/load, migrate. See:
 * (round-trip only
 * StudioProject JSON, never mutate input, no eval).
 */
import { buildIndexes, type StudioIndexes } from "./indexes.js";
import { createId } from "./ids.js";
import {
  RESERVED_NAMES,
  STUDIO_LAYOUT_MAX_DEPTH,
  STUDIO_SCHEMA_MAX_DEPTH,
  STUDIO_VERSION,
  type MdyStudioProject,
  type StudioDiagnostic,
  type StudioFieldKind,
  type StudioExpression,
  type StudioLayoutChild,
  type StudioLayoutNode,
  type StudioSchemaNode,
} from "./types.js";

/** Kinds whose value is picked from a declared list — an empty list makes them unusable. */
const OPTION_FIELD_KINDS: ReadonlySet<StudioFieldKind> = new Set(["select", "radio", "segmented", "multiselect"]);

/** Thrown for structurally invalid input — not a project shape at all. */
export class StudioModelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StudioModelError";
  }
}

export interface NormalizeResult {
  project: MdyStudioProject;
  diagnostics: StudioDiagnostic[];
}

function assertStructurallyValidProject(raw: unknown): asserts raw is MdyStudioProject {
  if (typeof raw !== "object" || raw === null) {
    throw new StudioModelError("Studio project must be an object");
  }
  const candidate = raw as Record<string, unknown>;
  if (typeof candidate["studioVersion"] !== "number") {
    throw new StudioModelError("Studio project missing numeric studioVersion");
  }
  if (typeof candidate["id"] !== "string" || candidate["id"] === "") {
    throw new StudioModelError("Studio project missing string id");
  }
  if (typeof candidate["name"] !== "string") {
    throw new StudioModelError("Studio project missing string name");
  }
  const schema = candidate["schema"];
  if (
    typeof schema !== "object" ||
    schema === null ||
    !["field", "group", "array"].includes((schema as Record<string, unknown>)["node"] as string)
  ) {
    throw new StudioModelError("Studio project missing valid schema root node");
  }
  if (typeof (schema as Record<string, unknown>)["id"] !== "string") {
    throw new StudioModelError("Studio project schema root missing string id");
  }
  for (const arrayField of ["formValidators"] as const) {
    if (!Array.isArray(candidate[arrayField])) {
      throw new StudioModelError(`Studio project missing array field: ${arrayField}`);
    }
  }
  for (const objectField of ["behaviors", "implementations", "presentation", "targets", "metadata"] as const) {
    if (typeof candidate[objectField] !== "object" || candidate[objectField] === null) {
      throw new StudioModelError(`Studio project missing object field: ${objectField}`);
    }
  }
}

/** No actual version migrations exist yet (only STUDIO_VERSION=1) — extend this when v2 ships. */
function migrate(raw: MdyStudioProject): MdyStudioProject {
  if (raw.studioVersion !== STUDIO_VERSION) {
    throw new StudioModelError(
      `Unsupported studioVersion ${raw.studioVersion}; only ${STUDIO_VERSION} is supported`,
    );
  }
  return raw;
}

function diagnoseProject(project: MdyStudioProject, idx: StudioIndexes): StudioDiagnostic[] {
  const diagnostics: StudioDiagnostic[] = [];

  for (const [parentId, childIds] of idx.childrenByParent) {
    const seen = new Map<string, string>();
    for (const childId of childIds) {
      const node = idx.nodeById.get(childId);
      if (!node) continue;
      const previous = seen.get(node.name);
      if (previous) {
        diagnostics.push({
          code: "DUPLICATE_SIBLING_NAME",
          severity: "error",
          message: `Duplicate sibling name "${node.name}" under parent ${parentId}`,
          nodeId: childId,
        });
      } else {
        seen.set(node.name, childId);
      }
    }
  }

  for (const [nodeId, node] of idx.nodeById) {
    if (RESERVED_NAMES.has(node.name)) {
      diagnostics.push({
        code: "RESERVED_NAME",
        severity: "error",
        message: `Node name "${node.name}" is reserved`,
        nodeId,
      });
    }
  }

  for (const targetNodeId of idx.referencesByTargetNode.keys()) {
    if (!idx.nodeById.has(targetNodeId)) {
      diagnostics.push({
        code: "BROKEN_REFERENCE",
        severity: "error",
        message: `Reference points at missing node ${targetNodeId}`,
        nodeId: targetNodeId,
      });
    }
  }

  const checkImplementationRef = (ref: string | undefined, sourceId: string): void => {
    if (ref && !project.implementations[ref]) {
      diagnostics.push({
        code: "MISSING_IMPLEMENTATION",
        severity: "error",
        message: `Missing implementation "${ref}" referenced by ${sourceId}`,
        validatorId: sourceId,
      });
    }
  };
  const draftExcluded = new Set((project.behaviors.draft?.exclude ?? []).map((ref) => ref.nodeId));
  const visit = (node: StudioSchemaNode): void => {
    if (node.node === "field") {
      for (const validator of node.validators) {
        checkImplementationRef(validator.implementationRef, validator.id);
        if (validator.kind === "pattern" && validator.pattern !== undefined) {
          try {
            new RegExp(validator.pattern);
          } catch {
            diagnostics.push({
              code: "BAD_PATTERN",
              severity: "error",
              message: `Invalid regular expression "${validator.pattern}"`,
              nodeId: node.id,
              validatorId: validator.id,
            });
          }
        }
      }
      if (node.serverValidator) {
        checkImplementationRef(node.serverValidator.implementationRef, node.serverValidator.id);
      }
      if (OPTION_FIELD_KINDS.has(node.fieldKind) && !node.options?.length) {
        diagnostics.push({
          code: "SELECT_WITHOUT_OPTIONS",
          severity: "error",
          message: `Field "${node.name}" is a ${node.fieldKind} with no options`,
          nodeId: node.id,
        });
      }
      if (SENSITIVE_FIELD_NAME.test(node.name) || (node.label && SENSITIVE_FIELD_NAME.test(node.label))) {
        if (!draftExcluded.has(node.id)) {
          diagnostics.push({
            code: "SENSITIVE_FIELD_IN_DRAFT",
            severity: "warning",
            message: `Field "${node.name}" looks sensitive and is not excluded from the draft (behaviors.draft.exclude)`,
            nodeId: node.id,
          });
        }
      }
    }
    if (node.node === "group") {
      for (const child of node.children) visit(child);
    } else if (node.node === "array") {
      visit(node.item);
    }
  };
  visit(project.schema);
  if (project.behaviors.submit) {
    checkImplementationRef(project.behaviors.submit.implementationRef, "behaviors.submit");
  }
  for (const validator of project.formValidators) {
    diagnostics.push(...diagnoseCondition(validator.condition, validator.id));
  }
  // Deeper than this editor will place. Reported rather than refused: an import or a generator can
  // legitimately produce it and the value is the author's, but a project nobody can then edit is
  // something they have to be told about — the editor's own bound, read from one place so the two
  // cannot disagree again.
  // Counted the way a placement is: the editor asks how many ancestors a node would have, and the
  // root is not one of them. Two bounds that mean different things by "depth" agree on the number
  // and disagree by one, which is the kind of difference nobody finds until a project sits on it.
  const nesting = Math.max(0, schemaDepth(project.schema).depth - 1);
  if (nesting > STUDIO_SCHEMA_MAX_DEPTH) {
    diagnostics.push({
      code: "SCHEMA_TOO_DEEP",
      severity: "warning",
      message: `Schema nests ${nesting} levels, deeper than the ${STUDIO_SCHEMA_MAX_DEPTH} this editor will place`,
    });
  }
  diagnostics.push(...diagnoseLayout(project, idx));

  return diagnostics;
}


/**
 * Operands a condition may hold, checked where the project is read.
 *
 * A condition is compiled into the source a consumer builds, so an operand outside the declared
 * kinds is not a display problem: an array reaches the emitted expression through its own join, and
 * `["globalThis.taken = 1"]` becomes an assignment in generated code. The compiler refuses it too —
 * these are two different consumers, and the one holding the file is the one who can fix it.
 *
 * Reported rather than thrown, like every other finding here: a project that cannot be opened cannot
 * be repaired in the editor that reports this.
 */
function diagnoseCondition(
  condition: StudioExpression | undefined,
  validatorId: string,
  depth = 0,
): StudioDiagnostic[] {
  if (condition === undefined || depth > STUDIO_LAYOUT_MAX_DEPTH) return [];
  const operands = condition.operands ?? (condition.operand !== undefined ? [condition.operand] : []);
  const found: StudioDiagnostic[] = [];
  for (const operand of operands) {
    if (operand === null || operand === undefined) continue;
    if (typeof operand === "object" && "op" in operand) {
      found.push(...diagnoseCondition(operand as StudioExpression, validatorId, depth + 1));
      continue;
    }
    if (typeof operand === "object" && "nodeId" in operand) continue;
    if (typeof operand === "string" || typeof operand === "boolean") continue;
    if (typeof operand === "number" && Number.isFinite(operand)) continue;
    found.push({
      code: "BAD_CONDITION_OPERAND",
      severity: "error",
      message:
        `Condition of "${validatorId}" holds ${Array.isArray(operand) ? "an array" : `a ${typeof operand}`}, ` +
        "which is not a node reference, a string, a finite number, a boolean, null or a nested condition",
      validatorId,
    });
  }
  return found;
}

/**
 * Layout is arrangement over the schema, so it can go stale: a node it references may have been
 * deleted, and a node must not be placed twice. Reported rather than thrown — a stale layout
 * should degrade to "unarranged", never block opening the project.
 */
function diagnoseLayout(project: MdyStudioProject, idx: StudioIndexes): StudioDiagnostic[] {
  const layout = project.presentation.layout;
  if (!layout?.length) return [];
  const diagnostics: StudioDiagnostic[] = [];
  const placed = new Set<string>();

  const visitChild = (child: StudioLayoutChild, path: string, depth: number): void => {
    if (depth > STUDIO_LAYOUT_MAX_DEPTH) {
      diagnostics.push({ code: "LAYOUT_TOO_DEEP", severity: "warning", message: `Layout nesting exceeds ${STUDIO_LAYOUT_MAX_DEPTH} levels at ${path}`, propertyPath: path });
      return;
    }
    if ("nodeId" in child) {
      if (!idx.nodeById.has(child.nodeId)) {
        diagnostics.push({ code: "LAYOUT_UNKNOWN_NODE", severity: "warning", message: `Layout at ${path} references a node that no longer exists`, nodeId: child.nodeId, propertyPath: path });
        return;
      }
      if (placed.has(child.nodeId)) {
        diagnostics.push({ code: "LAYOUT_DUPLICATE_NODE", severity: "warning", message: `Node is placed more than once in the layout (${path})`, nodeId: child.nodeId, propertyPath: path });
        return;
      }
      placed.add(child.nodeId);
      return;
    }
    visitNode(child, path, depth);
  };

  const visitNode = (node: StudioLayoutNode, path: string, depth: number): void => {
    if (node.kind === "section") {
      node.children.forEach((child, index) => visitChild(child, `${path}/children/${index}`, depth + 1));
      return;
    }
    node.columns.forEach((column, columnIndex) =>
      column.forEach((child, index) => visitChild(child, `${path}/columns/${columnIndex}/${index}`, depth + 1)),
    );
  };

  layout.forEach((node, index) => visitNode(node, `presentation.layout/${index}`, 1));
  return diagnostics;
}

const SENSITIVE_FIELD_NAME = /password|secret|token|ssn|credit.?card|cvv|\bpin\b/i;


/**
 * A hard bound on how deeply a layout may nest at all, distinct from the arrangement warning.
 *
 * `STUDIO_LAYOUT_MAX_DEPTH` is a judgement about arrangement — six levels is more than a form should
 * need, and past it the walk reports and carries on. This is a different question: what can be
 * *processed*. `structuredClone` recurses, so a layout a few thousand deep raised a `RangeError`
 * inside the clone before any guard ran, and the difference between a diagnostic and a `RangeError`
 * is the difference between a message and a host that stopped.
 *
 * Generous on purpose. No arrangement a person makes comes near it, and a project that does was made
 * by a generator, an import or a loop.
 */
const STUDIO_LAYOUT_MAX_STRUCTURAL_DEPTH = 100;

/**
 * What is wrong with a layout before it can be cloned, or `null` when it can.
 *
 * Walked over an explicit stack, on the **raw** input, ahead of `structuredClone` — a guard that
 * runs after the clone is a guard the clone can defeat.
 *
 * Cycles are looked for by identity along the current path: `structuredClone` *preserves* a cycle
 * rather than breaking it, so a section dropped into itself — which is what a drag produces —
 * survived the clone and was reported as `LAYOUT_TOO_DEEP`. That is technically true and is the
 * wrong message: a person reading it goes looking for a deep nesting they do not have.
 */
function schemaDepth(schema: unknown): { depth: number; cyclic: boolean } {
  // The same walk the layout gets, on the other structure that goes through the same clone. A
  // project carries two nested things and `structuredClone` recurses through both: the layout was
  // guarded ahead of it and the schema went on reaching the identical frame, at the identical depth.
  let deepest = 0;
  const pending: Array<{ node: unknown; depth: number; ancestors: ReadonlySet<unknown> }> = [
    { node: schema, depth: 1, ancestors: new Set() },
  ];
  while (pending.length > 0) {
    const { node, depth, ancestors } = pending.pop()!;
    if (typeof node !== "object" || node === null) continue;
    if (ancestors.has(node)) return { depth: deepest, cyclic: true };
    if (depth > deepest) deepest = depth;
    // Deep enough to be unprocessable is deep enough to stop counting: the answer cannot get smaller
    // and walking the rest of a generated tree costs the memory the guard exists to protect.
    if (deepest > STUDIO_LAYOUT_MAX_STRUCTURAL_DEPTH) return { depth: deepest, cyclic: false };
    const here = new Set(ancestors).add(node);
    const record = node as { children?: unknown; item?: unknown };
    if (Array.isArray(record.children)) {
      for (const child of record.children) pending.push({ node: child, depth: depth + 1, ancestors: here });
    }
    if (record.item !== undefined) pending.push({ node: record.item, depth: depth + 1, ancestors: here });
  }
  return { depth: deepest, cyclic: false };
}

function unprocessableLayout(layout: unknown): { code: string; message: string } | null {
  if (!Array.isArray(layout)) return null;
  const pending: Array<{ node: unknown; depth: number; ancestors: ReadonlySet<unknown> }> =
    layout.map((node) => ({ node, depth: 1, ancestors: new Set() }));

  while (pending.length > 0) {
    const { node, depth, ancestors } = pending.pop()!;
    if (typeof node !== "object" || node === null) continue;
    if (ancestors.has(node)) {
      return {
        code: "LAYOUT_CYCLE",
        message: "A layout node contains itself, so the arrangement has no depth to walk",
      };
    }
    if (depth > STUDIO_LAYOUT_MAX_STRUCTURAL_DEPTH) {
      return {
        code: "LAYOUT_TOO_DEEP",
        message: `Layout nests deeper than ${STUDIO_LAYOUT_MAX_STRUCTURAL_DEPTH} levels and cannot be processed`,
      };
    }
    const here = new Set(ancestors).add(node);
    const record = node as { children?: unknown; columns?: unknown };
    if (Array.isArray(record.children)) {
      for (const child of record.children) pending.push({ node: child, depth: depth + 1, ancestors: here });
    }
    if (Array.isArray(record.columns)) {
      for (const column of record.columns) {
        if (!Array.isArray(column)) continue;
        for (const child of column) pending.push({ node: child, depth: depth + 1, ancestors: here });
      }
    }
  }
  return null;
}

/** Deep-clones input — normalize never mutates its argument (plan section 5 rule). */
export function normalize(project: MdyStudioProject): NormalizeResult {
  const cloned = structuredClone(project);
  const idx = buildIndexes(cloned);
  const diagnostics = diagnoseProject(cloned, idx);
  return { project: cloned, diagnostics };
}

/** Strict-parses/migrates/normalizes untrusted input. Throws on structurally invalid input. */
export function loadProject(raw: unknown): NormalizeResult {
  assertStructurallyValidProject(raw);
  const migrated = migrate(raw);
  // A layout nobody can walk is dropped rather than carried: this module's own rule is that a stale
  // arrangement degrades to "unarranged" and never blocks opening the project, and a layout that
  // cannot be cloned is the most stale one there is. The finding says which of the two it was.
  // The schema is not arrangement: a project without it is not a project, so a schema nobody can
  // clone is refused rather than degraded. `loadProject` already throws for input it cannot use.
  const schema = schemaDepth((migrated as { schema?: unknown }).schema);
  if (schema.cyclic) {
    throw new StudioModelError("Studio project schema contains itself, so it has no depth to walk");
  }
  if (schema.depth > STUDIO_LAYOUT_MAX_STRUCTURAL_DEPTH) {
    throw new StudioModelError(
      `Studio project schema nests deeper than ${STUDIO_LAYOUT_MAX_STRUCTURAL_DEPTH} levels and cannot be processed`,
    );
  }

  const unprocessable = unprocessableLayout(
    (migrated as { presentation?: { layout?: unknown } }).presentation?.layout,
  );
  if (unprocessable) {
    const withoutLayout = {
      ...migrated,
      presentation: { ...migrated.presentation, layout: undefined },
    } as MdyStudioProject;
    const result = normalize(withoutLayout);
    return {
      project: result.project,
      diagnostics: [
        { code: unprocessable.code, severity: "error", message: unprocessable.message, propertyPath: "presentation.layout" },
        ...result.diagnostics,
      ],
    };
  }
  return normalize(migrated);
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    const sorted: Record<string, unknown> = {};
    for (const [key, val] of entries) sorted[key] = sortKeysDeep(val);
    return sorted;
  }
  return value;
}

/** Deterministic serialization: key order never depends on construction/edit history. */
export function serializeProject(project: MdyStudioProject): string {
  return JSON.stringify(sortKeysDeep(project), null, 2);
}

/** Creates the editor's initial state. Examples are loaded explicitly as templates. */
export function createBlankProject(name = "Untitled form"): MdyStudioProject {
  return {
    studioVersion: STUDIO_VERSION,
    id: createId("prj"),
    name,
    schema: { node: "group", id: createId("nd"), name: "root", children: [] },
    formValidators: [],
    behaviors: {},
    implementations: {},
    presentation: {},
    targets: {},
    metadata: {},
  };
}
