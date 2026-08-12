/**
 * Project -> Contract v2 compiler (plan section 10). Reuses studio-model's
 * own standing diagnostics (normalize()), maps the schema tree, and then
 * strict-parses the result with the *real* @modyra/core parser — the
 * authoritative check that generated output is actually valid, not just
 * "looks right" per this package's own assumptions (ADR
 *.
 *
 * Cross-field validators compile to the contract's `validations` slot, which carries a condition
 * and a message; Studio's node ids become dotted paths at that boundary, since nothing outside
 * Studio can resolve an id.
 *
 * Deliberately unmappable, reported as diagnostics rather than silently
 * dropped or force-fit: server validators (no Contract v2 equivalent at
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
  type StudioLayoutColumns,
  type StudioLayoutNode,
  type StudioLayoutSlot,
  type StudioSchemaNode,
} from "@modyra/studio-model";
import {
  parseDynamicForm,
  type MdyDynamicField,
  type MdyDynamicFieldNode,
  type MdyDynamicFormConfigV2,
  type MdyDynamicFormConfigV3,
  type MdyDynamicGroupNode,
  type MdyDynamicLayoutChild,
  type MdyDynamicLayoutNode,
  type MdyDynamicLayoutSlot,
  type MdyDynamicNode,
  type MdyDynamicSection,
  type MdyDynamicValidation,
  type MdyDynamicValidators,
} from "@modyra/core";
import type { MdyExpression } from "@modyra/core";
import { ExpressionTooDeepError, toContractExpression } from "./expression.js";
// Type-only: the catalog constrains what this may map to, and nothing of it survives compilation,
// so this package still ships with no runtime dependency beyond core and the studio model.
import type { MdyWidgetKind } from "@modyra/widgets";

/**
 * What Studio compiles to.
 *
 * A union rather than v3 outright: the version a project compiles to is the lowest one that can say
 * what the project says, so a form that never authored a per-breakpoint placement still produces the
 * v2 document every existing reader expects.
 */
export type StudioContract = MdyDynamicFormConfigV2 | MdyDynamicFormConfigV3;

export interface CompileResult {
  contract: StudioContract | null;
  diagnostics: StudioDiagnostic[];
}

/**
 * Studio's own field kinds, mapped onto the widget catalog's.
 *
 * The target type is `MdyWidgetKind` — the catalog's, from `@modyra/widgets` — rather than a string
 * that happens to look like one. A kind renamed or dropped in the catalog then fails to compile
 * here, instead of producing a contract whose fields no renderer knows how to draw.
 */
const FIELD_KIND_MAP: Record<FieldNode["fieldKind"], MdyDynamicField["kind"] & MdyWidgetKind> = {
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
      field: { label: node.label, initialValue: node.initialValue, validators, kind, options: node.options, ...(node.sensitive !== undefined ? { sensitive: node.sensitive } : {}) } as Omit<
        MdyDynamicField,
        "name"
      >,
    };
  }

  return {
    node: "field",
    field: { label: node.label, initialValue: node.initialValue, validators, kind, ...(node.sensitive !== undefined ? { sensitive: node.sensitive } : {}) } as Omit<MdyDynamicField, "name">,
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

/**
 * One project field as the Contract field a renderer consumes, named at `name`.
 *
 * The whole-project compiler flattens arrays from their *initial* rows, so it cannot describe a row
 * the user pushed in Preview. Preview knows the live path; this gives it the descriptor for that
 * path from the same mapping `compileToContract` uses, so a previewed control is the control the
 * contract asks for rather than a second opinion about it.
 *
 * Returns null for a field that cannot be compiled at all (an option field with no options) — the
 * caller has nothing to render and `compileToContract` already reports why.
 */
export function dynamicFieldForNode(node: FieldNode, name: string): MdyDynamicField | null {
  const mapped = mapFieldNode(node, []);
  return mapped ? ({ ...mapped.field, name } as MdyDynamicField) : null;
}

function mapArrayNode(node: ArrayNode, diagnostics: StudioDiagnostic[]): MdyDynamicNode | null {
  const item = mapNode(node.item, diagnostics);
  // A row is a field or a group. The project's model has no collection inside a row to map, and the
  // Contract would not accept one either — both collection kinds are refused here rather than only
  // the one that existed when this was written.
  if (!item || item.node === "array" || item.node === "record") return null;

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
 * fields by their derived dotted name — so this is the one place the two spellings meet. The
 * Contract's layout only ever addresses leaves, so a slot pointing at a container is expanded to the
 * field names underneath it — inside a section that keeps the container's identity, rather than
 * spilling the leaves into whatever slot the container occupied.
 *
 * That distinction is the whole reason a group can sit in a column. Spilled leaves land in the cell
 * one by one and the group stops existing; a section is a single child, so a row holding a group is
 * a row of two things rather than a row of however many fields the group happens to contain.
 */
/** The sizes a layout may be authored against; anything else in a stale project is dropped. */
const LAYOUT_SIZES = ["base", "sm", "md", "lg"] as const;

/**
 * A slot's placement, keeping only what a renderer can act on.
 *
 * A size that says nothing is dropped rather than emitted: the Contract refuses an empty one, and a
 * project half-edited in the canvas is the ordinary way to end up with one.
 */
function childPlacement(child: StudioLayoutSlot): MdyDynamicLayoutSlot["at"] | null {
  if (!child.at) return null;
  const out: Record<string, { column?: number; hidden?: boolean }> = {};
  for (const size of LAYOUT_SIZES) {
    const placement = child.at[size];
    if (!placement) continue;
    const column = typeof placement.column === "number" && Number.isInteger(placement.column) && placement.column >= 1
      ? placement.column
      : undefined;
    const hidden = typeof placement.hidden === "boolean" ? placement.hidden : undefined;
    if (column === undefined && hidden === undefined) continue;
    out[size] = { ...(column !== undefined ? { column } : {}), ...(hidden !== undefined ? { hidden } : {}) };
  }
  return Object.keys(out).length ? (out as MdyDynamicLayoutSlot["at"]) : null;
}

/**
 * Drops a `column` the row no longer has, and the placement when nothing usable is left.
 *
 * Both a slot and a section can carry one, and both are trimmed the same way — a group's column can
 * go out of range exactly as a field's does, by the row narrowing under it.
 */
function trimToRow(child: MdyDynamicLayoutChild, tracks: number): MdyDynamicLayoutChild {
  if (typeof child === "string") return child;
  const isSlot = "ref" in child;
  const source = isSlot ? child.at : child.kind === "section" ? child.at : undefined;
  if (!source) return child;
  const at: Record<string, { column?: number; hidden?: boolean }> = {};
  for (const [size, placement] of Object.entries(source)) {
    const column = placement.column !== undefined && placement.column <= tracks ? placement.column : undefined;
    if (column === undefined && placement.hidden === undefined) continue;
    at[size] = { ...(column !== undefined ? { column } : {}), ...(placement.hidden !== undefined ? { hidden: placement.hidden } : {}) };
  }
  const kept = Object.keys(at).length ? (at as MdyDynamicLayoutSlot["at"]) : undefined;
  if (isSlot) return kept ? { ref: child.ref, at: kept } : child.ref;
  // A section without a usable placement is the section it always was, minus the key.
  const { at: _dropped, ...rest } = child as MdyDynamicSection;
  return kept ? { ...rest, at: kept } : rest;
}

/** Whether a finished layout node places anything under it — what decides v3 over v2. */
function placesASlot(node: MdyDynamicLayoutNode): boolean {
  if (node.kind === "section" && node.at !== undefined) return true;
  const children = node.kind === "section" ? node.children : node.columns.flat();
  return children.some((child) =>
    typeof child !== "string" && ("ref" in child ? child.at !== undefined : placesASlot(child)),
  );
}

/** A row's track counts, dropped where they are not a count a row could have. */
function rowCounts(
  at: StudioLayoutColumns["at"],
  declared: number,
): Partial<Record<(typeof LAYOUT_SIZES)[number], number>> | null {
  if (!at) return null;
  const out: Partial<Record<(typeof LAYOUT_SIZES)[number], number>> = {};
  for (const size of LAYOUT_SIZES) {
    const count = at[size];
    if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > declared) continue;
    out[size] = count;
  }
  return Object.keys(out).length ? out : null;
}

function mapLayout(
  project: MdyStudioProject,
  diagnostics: StudioDiagnostic[],
): { nodes: MdyDynamicLayoutNode[]; usesSlots: boolean } {
  const source = project.presentation.layout ?? [];
  if (!source.length) return { nodes: [], usesSlots: false };
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
  /**
   * `inRow` is what makes a placement emittable: the Contract refuses `at` outside a columns row,
   * because the column is the only element a placement can act on. A stale project — one whose row
   * was later turned back into a section — would otherwise compile to a contract the strict parser
   * rejects, and the whole layout would be dropped over an override nobody could see anyway.
   */
  const mapChild = (child: StudioLayoutChild, inRow: boolean): MdyDynamicLayoutChild[] => {
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
        return [];
      }
      const slot = idx.nodeById.get(child.nodeId);
      if (slot && slot.node !== "field") {
        // One child, not several — see the note on this function. The container's own id becomes the
        // section's, so a renderer can tell which group a box on screen is, and a second compile of
        // the same project produces the same layout.
        //
        // The placement rides on the section, because in a row the section *is* the column: without
        // it, hiding a group at a size would be authorable in Studio and silently dropped here.
        const at = inRow ? childPlacement(child) : null;
        return [{
          kind: "section",
          id: slot.id,
          ...(slot.label ? { label: slot.label } : {}),
          children: names,
          ...(at ? { at } : {}),
        }];
      }
      // A slot with something to say compiles to v3's `{ ref, at }`; one with nothing to say stays
      // the bare name it has always been, so authoring a breakpoint somewhere in the form does not
      // rewrite every other slot in it.
      const placement = inRow ? childPlacement(child) : null;
      if (placement && names.length === 1) {
        return [{ ref: names[0]!, at: placement }];
      }
      return names;
    }
    const mapped = mapNode(child);
    return mapped ? [mapped] : [];
  };

  const mapNode = (node: StudioLayoutNode): MdyDynamicLayoutNode | null => {
    if (node.kind === "section") {
      const children = node.children.flatMap((child) => mapChild(child, false));
      if (!children.length) return null;
      return { kind: "section", id: node.id, ...(node.label ? { label: node.label } : {}), children };
    }
    const mapped = node.columns.map((column) => column.flatMap((child) => mapChild(child, true))).filter((column) => column.length > 0);
    if (mapped.length < 2) return null; // a one-column row is not a layout, it is just the field
    // A slot may still name a track the row no longer has — deleting a field narrows the row and
    // leaves every other slot's `column` pointing past its end. The Contract refuses that, and the
    // whole layout would go down with it, so the placement is trimmed to what this row can honour.
    const columns = mapped.map((column) => column.map((child) => trimToRow(child, mapped.length)));
    // The row's own track counts are v2's and ride along unchanged; only a slot's placement is v3.
    const at = rowCounts(node.at, columns.length);
    return { kind: "columns", id: node.id, columns, ...(at ? { at } : {}) };
  };

  const nodes = source.flatMap((node) => {
    const mapped = mapNode(node);
    return mapped ? [mapped] : [];
  });
  // Read off the finished layout rather than tracked while building it: a placement can still be
  // trimmed away after the slot that carried it was emitted, and a document must not claim v3 for a
  // slot that no longer says anything v3 could express.
  return { nodes, usesSlots: nodes.some(placesASlot) };
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

  // Cross-field validators compile to the contract's `validations`, which carries a condition and a
  // message. The only thing that has to change is how a field is named: Studio's node ids become
  // paths, so the condition means the same thing to a reader that has never heard of Studio.
  const idx = buildIndexes(normalized);
  const validations: MdyDynamicValidation[] = [];
  for (const v of normalized.formValidators) {
    let when: MdyExpression;
    try {
      when = toContractExpression(v.condition, idx.pathByNode);
    } catch (error) {
      // The two failures a translation has are different things to fix: a reference to a deleted
      // field, and a condition too deep to carry. Reporting both as the first sends the author
      // looking for a field that is not the problem.
      const tooDeep = error instanceof ExpressionTooDeepError;
      diagnostics.push({
        code: tooDeep ? "EXPRESSION_TOO_DEEP" : "UNRESOLVED_REFERENCE",
        severity: "error",
        message: tooDeep
          ? `Form validator "${v.id}" has a condition too deeply nested to compile: ${(error as Error).message}`
          : `Form validator "${v.id}" refers to a field that is not in the schema: ${(error as Error).message}`,
        validatorId: v.id,
      });
      continue;
    }
    // The two say the opposite thing. A Studio validator's `condition` is the rule that must
    // *hold*; the contract's `when` is the condition under which the form is *invalid*. Emitting one
    // as the other inverts every cross-field rule in the form, so the negation is explicit here.
    when = { op: "not", operands: [when] };

    const target = v.errorTarget ? idx.pathByNode.get(v.errorTarget.nodeId) : undefined;
    if (v.errorTarget && target === undefined) {
      diagnostics.push({
        code: "UNRESOLVED_REFERENCE",
        severity: "error",
        message: `Form validator "${v.id}" targets a field that is not in the schema`,
        validatorId: v.id,
        nodeId: v.errorTarget.nodeId,
      });
      continue;
    }
    validations.push({ when, message: v.message, ...(target ? { target } : {}) });
  }

  const schema = mapGroupNode(normalized.schema, diagnostics);

  // Any error so far (from normalize()'s own standing diagnostics, or a field that
  // couldn't be mapped at all, e.g. UNCOMPILABLE_FIELD) means the schema is already
  // incomplete/broken — omitting the offending field and reporting success anyway
  // would silently ship a Contract missing data the project actually declares.
  if (diagnostics.some((d) => d.severity === "error")) {
    return { contract: null, diagnostics };
  }

  const { nodes: layout, usesSlots } = mapLayout(normalized, diagnostics);
  // The version is raised only by what the project actually uses. A form that never authored a
  // per-breakpoint placement compiles to the v2 it always did, so nothing downstream — an SDK, a
  // stored contract, a target that reads the version — has to change because v3 exists.
  const candidate: StudioContract = {
    version: usesSlots ? 3 : 2,
    id: normalized.id,
    schema,
    ...(layout.length ? { layout } : {}),
    ...(validations.length ? { validations } : {}),
  };
  const parsed = parseDynamicForm(candidate, { mode: "strict" });

  // Layout is arrangement over the schema. If only the layout is unacceptable, ship the form
  // without it and say so — a decoration problem must never cost the user their whole form.
  if (!parsed.ok && layout.length && parsed.diagnostics.every((d) => d.path.startsWith("/layout"))) {
    const withoutLayout: MdyDynamicFormConfigV2 = { version: 2, id: normalized.id, schema, ...(validations.length ? { validations } : {}) };
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
