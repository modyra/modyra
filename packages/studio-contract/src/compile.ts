/**
 * Project -> Contract v2 compiler (plan section 10). Reuses studio-model's
 * own standing diagnostics (normalize()), maps the schema tree, and then
 * strict-parses the result with the *real* @modyra/core parser — the
 * authoritative check that generated output is actually valid, not just
 * "looks right" per this package's own assumptions (ADR
 * .modyra/studio/adr/0001-project-and-contract-model.md).
 *
 * Deliberately unmappable, reported as diagnostics rather than silently
 * dropped or force-fit: form/cross-field validators (Contract v2's `rules`
 * are visibility/enable effects, not validation-with-a-message — a
 * different concept), server validators (no Contract v2 equivalent at
 * all — that's a target-generation concern, not schema data), and the
 * oneOf/eachOneOf/customRef field-validator kinds (no `MdyDynamicValidators`
 * slot for them; for select/multiselect Contract already auto-derives an
 * equivalent whitelist from `options`, so this is a soft warning, not a
 * blocking error).
 */
import {
  normalize,
  type ArrayNode,
  type FieldNode,
  type GroupNode,
  type MdyStudioProject,
  type StudioDiagnostic,
  type StudioSchemaNode,
} from "@modyra/studio-model";
import {
  parseDynamicForm,
  type MdyDynamicField,
  type MdyDynamicFieldNode,
  type MdyDynamicFormConfigV2,
  type MdyDynamicGroupNode,
  type MdyDynamicNode,
  type MdyDynamicValidators,
} from "@modyra/core/dynamic-config";

export interface CompileResult {
  contract: MdyDynamicFormConfigV2 | null;
  diagnostics: StudioDiagnostic[];
}

const FIELD_KIND_MAP: Record<FieldNode["fieldKind"], MdyDynamicField["kind"]> = {
  text: "text",
  textarea: "textarea",
  email: "email",
  number: "number",
  checkbox: "checkbox",
  select: "select",
  multiselect: "multiselect",
  date: "datepicker",
};

function mapValidators(node: FieldNode, diagnostics: StudioDiagnostic[]): MdyDynamicValidators | undefined {
  const out: Record<string, unknown> = {};
  for (const v of node.validators) {
    switch (v.kind) {
      case "required":
        out.required = true;
        break;
      case "email":
        out.email = true;
        break;
      case "min":
        out.min = v.value;
        break;
      case "max":
        out.max = v.value;
        break;
      case "minLength":
        out.minLength = v.value;
        break;
      case "maxLength":
        out.maxLength = v.value;
        break;
      case "pattern":
        out.pattern = v.pattern;
        break;
      default:
        diagnostics.push({
          code: "UNSUPPORTED_VALIDATOR",
          severity: "warning",
          message: `Validator kind "${v.kind}" has no Contract v2 equivalent and was omitted`,
          nodeId: node.id,
          validatorId: v.id,
        });
    }
  }
  return Object.keys(out).length ? (out as MdyDynamicValidators) : undefined;
}

function mapFieldNode(node: FieldNode, diagnostics: StudioDiagnostic[]): MdyDynamicFieldNode | null {
  const kind = FIELD_KIND_MAP[node.fieldKind];
  const validators = mapValidators(node, diagnostics);

  if (node.serverValidator) {
    diagnostics.push({
      code: "UNSUPPORTED_FEATURE",
      severity: "warning",
      message: `Server validator on "${node.name}" has no Contract v2 equivalent and was omitted`,
      nodeId: node.id,
      validatorId: node.serverValidator.id,
    });
  }

  if (node.fieldKind === "select" || node.fieldKind === "multiselect") {
    if (!node.options?.length) {
      // studio-model's own normalize() already raises SELECT_WITHOUT_OPTIONS for this;
      // here it additionally means the field can't be compiled into a Contract at all.
      diagnostics.push({
        code: "UNCOMPILABLE_FIELD",
        severity: "error",
        message: `Field "${node.name}" (${node.fieldKind}) has no options and cannot be compiled`,
        nodeId: node.id,
      });
      return null;
    }
    return {
      node: "field",
      field: { label: node.label, initialValue: node.initialValue, validators, kind, options: node.options } as Omit<
        MdyDynamicField,
        "name"
      >,
    };
  }

  return {
    node: "field",
    field: { label: node.label, initialValue: node.initialValue, validators, kind } as Omit<MdyDynamicField, "name">,
  };
}

function mapGroupNode(node: GroupNode, diagnostics: StudioDiagnostic[]): MdyDynamicGroupNode {
  const children: Record<string, MdyDynamicNode> = {};
  for (const child of node.children) {
    const mapped = mapNode(child, diagnostics);
    if (mapped) children[child.name] = mapped;
  }
  return { node: "group", label: node.label, children };
}

function mapArrayNode(node: ArrayNode, diagnostics: StudioDiagnostic[]): MdyDynamicNode | null {
  const item = mapNode(node.item, diagnostics);
  if (!item || item.node === "array") return null; // item is FieldNode | GroupNode by type; array-of-array can't happen

  for (const v of node.validators) {
    if (v.kind !== "min" && v.kind !== "max") {
      diagnostics.push({
        code: "UNSUPPORTED_VALIDATOR",
        severity: "warning",
        message: `Array validator kind "${v.kind}" has no Contract v2 equivalent and was omitted`,
        nodeId: node.id,
        validatorId: v.id,
      });
    }
  }
  const minItems = node.validators.find((v): v is typeof v & { value: number } => v.kind === "min")?.value;
  const maxItems = node.validators.find((v): v is typeof v & { value: number } => v.kind === "max")?.value;

  return {
    node: "array",
    label: node.label,
    item,
    initialValue: node.initialRows,
    ...(typeof minItems === "number" ? { minItems } : {}),
    ...(typeof maxItems === "number" ? { maxItems } : {}),
  };
}

function mapNode(node: StudioSchemaNode, diagnostics: StudioDiagnostic[]): MdyDynamicNode | null {
  if (node.node === "field") return mapFieldNode(node, diagnostics);
  if (node.node === "group") return mapGroupNode(node, diagnostics);
  return mapArrayNode(node, diagnostics);
}

export function compileToContract(project: MdyStudioProject): CompileResult {
  const diagnostics: StudioDiagnostic[] = [];

  // Reuse studio-model's own standing diagnostics (dup/reserved names, broken refs,
  // missing implementations, bad regex patterns, select-without-options, sensitive-in-draft).
  const { project: normalized, diagnostics: modelDiagnostics } = normalize(project);
  diagnostics.push(...modelDiagnostics);

  if (normalized.schema.node !== "group") {
    diagnostics.push({
      code: "ROOT_MUST_BE_GROUP",
      severity: "error",
      message: "Studio project schema root must be a group to compile to a Contract v2 form",
    });
    return { contract: null, diagnostics };
  }

  for (const v of normalized.formValidators) {
    diagnostics.push({
      code: "UNSUPPORTED_FEATURE",
      severity: "warning",
      message: `Form validator "${v.id}" (${v.kind}) has no Contract v2 equivalent (Contract v2's "rules" are visibility/enable effects, not validation-with-a-message) and was omitted`,
      validatorId: v.id,
    });
  }

  const schema = mapGroupNode(normalized.schema, diagnostics);

  // Any error so far (from normalize()'s own standing diagnostics, or a field that
  // couldn't be mapped at all, e.g. UNCOMPILABLE_FIELD) means the schema is already
  // incomplete/broken — omitting the offending field and reporting success anyway
  // would silently ship a Contract missing data the project actually declares.
  if (diagnostics.some((d) => d.severity === "error")) {
    return { contract: null, diagnostics };
  }

  const candidate: MdyDynamicFormConfigV2 = { version: 2, id: normalized.id, schema };
  const parsed = parseDynamicForm(candidate, { mode: "strict" });
  for (const d of parsed.diagnostics) {
    diagnostics.push({ code: d.code, severity: d.severity, message: d.message, propertyPath: d.path });
  }

  if (!parsed.ok) {
    return { contract: null, diagnostics };
  }
  return { contract: candidate, diagnostics };
}
