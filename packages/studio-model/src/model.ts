/**
 * Model services (plan section 5 "Required services"): normalize, validate/
 * diagnose, serialize/load, migrate. See:
 * .modyra/studio/adr/0001-project-and-contract-model.md (round-trip only
 * StudioProject JSON, never mutate input, no eval).
 */
import { buildIndexes, type StudioIndexes } from "./indexes.js";
import { createId } from "./ids.js";
import {
  RESERVED_NAMES,
  STUDIO_VERSION,
  type MdyStudioProject,
  type StudioDiagnostic,
  type StudioSchemaNode,
} from "./types.js";

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
      if ((node.fieldKind === "select" || node.fieldKind === "multiselect") && !node.options?.length) {
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

  return diagnostics;
}

const SENSITIVE_FIELD_NAME = /password|secret|token|ssn|credit.?card|cvv|\bpin\b/i;

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

/** Creates the editor's real initial state. Examples are loaded explicitly as templates. */
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
