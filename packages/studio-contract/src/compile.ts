/**
 * Project -> Contract v2 compiler (plan section 10). Reuses studio-model's
 * own standing diagnostics (normalize()), maps the schema tree, and then
 * strict-parses the result with the *real* @modyra/core parser — the
 * authoritative check that generated output is actually valid, not just
 * "looks right" per this package's own assumptions (ADR
 *.
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
  buildIndexes,
  normalize,
  type ArrayNode,
  type FieldNode,
  type GroupNode,
  type MdyStudioProject,
  type StudioDiagnostic,
  type StudioLayoutChild,
  type StudioLayoutNode,
  type StudioSchemaNode,
} from "@modyra/studio-model";
import {
  parseDynamicForm,
  type MdyDynamicField,
  type MdyDynamicFieldNode,
  type MdyDynamicFormConfigV2,
  type MdyDynamicGroupNode,
  type MdyDynamicLayoutChild,
  type MdyDynamicLayoutNode,
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
  password: "password",
  number: "number",
  slider: "slider",
  checkbox: "checkbox",
  toggle: "toggle",
  select: "select",
  radio: "radio",
  segmented: "segmented",
  multiselect: "multiselect",
  date: "datepicker",
  time: "timepicker",
};

/** Contract v2's MdyDynamicOptionsField kinds — all of them require a non-empty option list. */
const OPTION_FIELD_KINDS: ReadonlySet<FieldNode["fieldKind"]> = new Set(["select", "radio", "segmented", "multiselect"]);

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

  if (OPTION_FIELD_KINDS.has(node.fieldKind)) {
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

/**
 * Translates the project's node-ID layout into the Contract's field-name layout.
 *
 * The project stores IDs (ADR-0002: a reference is never a path), while the Contract addresses
 * fields by their derived dotted name — so this is the one place the two spellings meet. A slot
 * pointing at a group or array is expanded to the field names underneath it: the Contract's
 * layout only ever addresses leaves.
 */
function mapLayout(project: MdyStudioProject, diagnostics: StudioDiagnostic[]): MdyDynamicLayoutNode[] {
  const source = project.presentation.layout ?? [];
  if (!source.length) return [];
  const idx = buildIndexes(project);

  const leafNames = (nodeId: string): string[] => {
    const node = idx.nodeById.get(nodeId);
    if (!node) return [];
    if (node.node === "field") {
      const path = idx.pathByNode.get(nodeId);
      return path ? [path] : [];
    }
    // Groups and arrays are containers; the Contract layout arranges the leaves inside them.
    const children = idx.childrenByParent.get(nodeId) ?? [];
    return children.flatMap(leafNames);
  };

  // A field may be placed once. Deduping here means a stale layout can never produce a
  // Contract the strict parser rejects — which would otherwise take the whole form down.
  const emitted = new Set<string>();
  const mapChild = (child: StudioLayoutChild): MdyDynamicLayoutChild[] => {
    if ("nodeId" in child) {
      const names = leafNames(child.nodeId).filter((name) => {
        if (emitted.has(name)) return false;
        emitted.add(name);
        return true;
      });
      if (!names.length) {
        diagnostics.push({
          code: "LAYOUT_UNKNOWN_NODE",
          severity: "warning",
          message: "A layout slot references a node with no compilable field and was omitted",
          nodeId: child.nodeId,
        });
      }
      return names;
    }
    const mapped = mapNode(child);
    return mapped ? [mapped] : [];
  };

  const mapNode = (node: StudioLayoutNode): MdyDynamicLayoutNode | null => {
    if (node.kind === "section") {
      const children = node.children.flatMap(mapChild);
      if (!children.length) return null;
      return { kind: "section", id: node.id, ...(node.label ? { label: node.label } : {}), children };
    }
    const columns = node.columns.map((column) => column.flatMap(mapChild)).filter((column) => column.length > 0);
    if (columns.length < 2) return null; // a one-column row is not a layout, it is just the field
    return { kind: "columns", id: node.id, columns };
  };

  return source.flatMap((node) => {
    const mapped = mapNode(node);
    return mapped ? [mapped] : [];
  });
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
      // errorTarget, when set, is the most useful "where does this show up" node for a UI to point at.
      ...(v.errorTarget ? { nodeId: v.errorTarget.nodeId } : {}),
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

  const layout = mapLayout(normalized, diagnostics);
  const candidate: MdyDynamicFormConfigV2 = {
    version: 2,
    id: normalized.id,
    schema,
    ...(layout.length ? { layout } : {}),
  };
  const parsed = parseDynamicForm(candidate, { mode: "strict" });

  // Layout is arrangement over the schema. If only the layout is unacceptable, ship the form
  // without it and say so — a decoration problem must never cost the user their whole form.
  if (!parsed.ok && layout.length && parsed.diagnostics.every((d) => d.path.startsWith("/layout"))) {
    const withoutLayout: MdyDynamicFormConfigV2 = { version: 2, id: normalized.id, schema };
    const retry = parseDynamicForm(withoutLayout, { mode: "strict" });
    if (retry.ok) {
      diagnostics.push({
        code: "LAYOUT_DROPPED",
        severity: "warning",
        message: "The form layout could not be compiled and was omitted; the fields are unaffected",
        propertyPath: "/layout",
      });
      return { contract: withoutLayout, diagnostics };
    }
  }

  for (const d of parsed.diagnostics) {
    diagnostics.push({ code: d.code, severity: d.severity, message: d.message, propertyPath: d.path });
  }

  if (!parsed.ok) {
    return { contract: null, diagnostics };
  }
  return { contract: candidate, diagnostics };
}
