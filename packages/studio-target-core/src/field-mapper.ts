/**
 * Builds `form.ts`: the real @modyra/core `createForm()` schema, mapping
 * every Studio validator kind to a real core validator function (not a
 * reimplementation — the generated code imports and calls the real
 * @modyra/core/validators exports), plus draft/history options and
 * form-level `crossField` validators compiled via studio-codegen's
 * `compileExpressionToJs` (ADR-0005: portable expression -> real source).
 */
import {
  buildIndexes,
  type ArrayNode,
  type FieldNode,
  type GroupNode,
  type MdyStudioProject,
  type NodeRef,
  type StudioArrayValidator,
  type StudioDiagnostic,
  type StudioExpression,
  type StudioFieldValidator,
  type StudioFormValidator,
  type StudioIndexes,
  type StudioSchemaNode,
} from "@modyra/studio-model";
import { compileExpressionToJs, ImportResolver, printArray, printCall, printObject, printRegExp, printString, type TsProp } from "@modyra/studio-codegen";

export interface FormModuleResult {
  code: string;
  diagnostics: StudioDiagnostic[];
}

function literalCode(value: unknown): string {
  const json = JSON.stringify(value);
  return json === undefined ? "undefined" : json;
}

function collectRefs(expr: StudioExpression, out: string[]): void {
  const operands = expr.operands ?? (expr.operand !== undefined ? [expr.operand] : []);
  for (const o of operands) {
    if (o && typeof o === "object") {
      if ("nodeId" in o) out.push((o as NodeRef).nodeId);
      else if ("op" in o) collectRefs(o as StudioExpression, out);
    }
  }
}

/** `field()`'s `asyncWhen` receives the field's own value as its first argument — only usable when `skipWhen` refers to that same field, never a sibling (that would need the whole form value, a different calling convention). */
function mapSkipWhen(expr: StudioExpression, fieldId: string, fieldName: string, diagnostics: StudioDiagnostic[]): string | null {
  const refs: string[] = [];
  collectRefs(expr, refs);
  if (refs.some((id) => id !== fieldId)) {
    diagnostics.push({
      code: "UNSUPPORTED_SKIP_WHEN",
      severity: "warning",
      message: `skipWhen on "${fieldName}" references another field; the Core target only supports self-referencing skipWhen, so it was omitted`,
      nodeId: fieldId,
    });
    return null;
  }
  return compileExpressionToJs(expr, (id) => (id === fieldId ? "" : id));
}

function mapFieldValidator(
  v: StudioFieldValidator,
  node: FieldNode,
  imports: ImportResolver,
  diagnostics: StudioDiagnostic[],
  stubNameFor: Map<string, string>,
): string | null {
  const msgArg = v.message !== undefined ? [printString(v.message)] : [];
  switch (v.kind) {
    case "required":
      imports.add("@modyra/core", "required");
      return printCall("required", msgArg);
    case "email":
      imports.add("@modyra/core", "email");
      return printCall("email", msgArg);
    case "min":
    case "max":
    case "minLength":
    case "maxLength": {
      if (typeof v.value !== "number") {
        diagnostics.push({ code: "MISSING_VALIDATOR_VALUE", severity: "warning", message: `Validator "${v.kind}" on "${node.name}" has no numeric value and was omitted`, nodeId: node.id, validatorId: v.id });
        return null;
      }
      imports.add("@modyra/core", v.kind);
      return printCall(v.kind, [literalCode(v.value), ...msgArg]);
    }
    case "pattern": {
      if (typeof v.pattern !== "string") {
        diagnostics.push({ code: "MISSING_VALIDATOR_VALUE", severity: "warning", message: `Pattern validator on "${node.name}" has no pattern and was omitted`, nodeId: node.id, validatorId: v.id });
        return null;
      }
      imports.add("@modyra/core", "pattern");
      return printCall("pattern", [printRegExp(v.pattern), ...msgArg]);
    }
    case "oneOf":
    case "eachOneOf": {
      if (!Array.isArray(v.value)) {
        diagnostics.push({ code: "MISSING_VALIDATOR_VALUE", severity: "warning", message: `Validator "${v.kind}" on "${node.name}" has no value list and was omitted`, nodeId: node.id, validatorId: v.id });
        return null;
      }
      imports.add("@modyra/core", v.kind);
      return printCall(v.kind, [literalCode(v.value), ...msgArg]);
    }
    case "customRef": {
      const stubName = v.implementationRef ? stubNameFor.get(v.implementationRef) : undefined;
      if (!stubName) {
        diagnostics.push({ code: "MISSING_IMPLEMENTATION", severity: "error", message: `Custom validator on "${node.name}" has no resolvable implementation`, nodeId: node.id, validatorId: v.id });
        return null;
      }
      return stubName;
    }
    default:
      diagnostics.push({ code: "UNSUPPORTED_VALIDATOR", severity: "warning", message: `Validator kind "${v.kind}" is not supported by the Core target and was omitted`, nodeId: node.id, validatorId: v.id });
      return null;
  }
}

function mapArrayValidator(v: StudioArrayValidator, node: ArrayNode, imports: ImportResolver, diagnostics: StudioDiagnostic[]): string | null {
  const msgArg = v.message !== undefined ? [printString(v.message)] : [];
  if ((v.kind === "min" || v.kind === "max") && typeof v.value === "number") {
    const fn = v.kind === "min" ? "minLength" : "maxLength";
    imports.add("@modyra/core", fn);
    return printCall(fn, [literalCode(v.value), ...msgArg]);
  }
  diagnostics.push({ code: "UNSUPPORTED_VALIDATOR", severity: "warning", message: `Array validator kind "${v.kind}" is not supported by the Core target and was omitted`, nodeId: node.id, validatorId: v.id });
  return null;
}

function mapField(node: FieldNode, idx: StudioIndexes, imports: ImportResolver, diagnostics: StudioDiagnostic[], stubNameFor: Map<string, string>): string {
  imports.add("@modyra/core", "field");
  const validatorCodes = node.validators
    .map((v) => mapFieldValidator(v, node, imports, diagnostics, stubNameFor))
    .filter((c): c is string => c !== null);

  const optionProps: TsProp[] = [];
  if (node.serverValidator) {
    const sv = node.serverValidator;
    const stubName = stubNameFor.get(sv.implementationRef);
    if (!stubName) {
      diagnostics.push({ code: "MISSING_IMPLEMENTATION", severity: "error", message: `Server validator on "${node.name}" has no resolvable implementation`, nodeId: node.id, validatorId: sv.id });
    } else {
      optionProps.push({ key: "asyncValidators", value: printArray([stubName]) });
      if (sv.debounceMs !== undefined) optionProps.push({ key: "asyncDebounceMs", value: literalCode(sv.debounceMs) });
      if (sv.dependencies.length) {
        // asyncDependsOn wants dotted form-value paths, never internal Studio node IDs.
        optionProps.push({ key: "asyncDependsOn", value: literalCode(sv.dependencies.map((d) => idx.pathByNode.get(d.nodeId) ?? d.nodeId)) });
      }
      if (sv.timeoutMs !== undefined) optionProps.push({ key: "asyncTimeoutMs", value: literalCode(sv.timeoutMs) });
      if (sv.skipWhen) {
        const when = mapSkipWhen(sv.skipWhen, node.id, node.name, diagnostics);
        if (when) optionProps.push({ key: "asyncWhen", value: `(value) => (${when})` });
      }
    }
  }

  const args = [literalCode(node.initialValue)];
  if (validatorCodes.length || optionProps.length) args.push(printArray(validatorCodes));
  if (optionProps.length) args.push(printObject(optionProps));
  return printCall("field", args);
}

function mapGroup(node: GroupNode, idx: StudioIndexes, imports: ImportResolver, diagnostics: StudioDiagnostic[], stubNameFor: Map<string, string>): string {
  imports.add("@modyra/core", "group");
  const props: TsProp[] = node.children.map((child) => ({ key: child.name, value: mapNode(child, idx, imports, diagnostics, stubNameFor) }));
  return printCall("group", [printObject(props)]);
}

function mapArray(node: ArrayNode, idx: StudioIndexes, imports: ImportResolver, diagnostics: StudioDiagnostic[], stubNameFor: Map<string, string>): string {
  imports.add("@modyra/core", "array");
  const itemCode = mapNode(node.item, idx, imports, diagnostics, stubNameFor);
  const validatorCodes = node.validators
    .map((v) => mapArrayValidator(v, node, imports, diagnostics))
    .filter((c): c is string => c !== null);

  const optionProps: TsProp[] = [{ key: "initial", value: literalCode(node.initialRows) }];
  if (validatorCodes.length) optionProps.push({ key: "validators", value: printArray(validatorCodes) });
  return printCall("array", [itemCode, printObject(optionProps)]);
}

function mapNode(node: StudioSchemaNode, idx: StudioIndexes, imports: ImportResolver, diagnostics: StudioDiagnostic[], stubNameFor: Map<string, string>): string {
  if (node.node === "field") return mapField(node, idx, imports, diagnostics, stubNameFor);
  if (node.node === "group") return mapGroup(node, idx, imports, diagnostics, stubNameFor);
  return mapArray(node, idx, imports, diagnostics, stubNameFor);
}

function mapFormValidator(fv: StudioFormValidator, idx: StudioIndexes): string {
  const pathOf = (id: string): string => idx.pathByNode.get(id) ?? id;
  const condition = compileExpressionToJs(fv.condition, pathOf);
  const targetRefs = fv.errorTarget ? [fv.errorTarget] : fv.dependencies;
  const paths = targetRefs.map((r) => pathOf(r.nodeId)).filter((p) => p !== "");
  return `crossField(${literalCode(paths)}, (value) => (${condition}) ? null : ${literalCode(fv.message)})`;
}

/** Builds `form.ts`. `stubNameFor` maps implementationRef id -> the generated stub function name (from `buildStubsModule`). */
export function buildFormModule(project: MdyStudioProject, stubNameFor: Map<string, string>): FormModuleResult {
  const diagnostics: StudioDiagnostic[] = [];
  const imports = new ImportResolver();

  if (project.schema.node !== "group") {
    diagnostics.push({ code: "INVALID_ROOT", severity: "error", message: "Project schema root must be a group", nodeId: project.schema.id });
    return { code: "", diagnostics };
  }

  const idx = buildIndexes(project);
  const schemaProps: TsProp[] = project.schema.children.map((child) => ({
    key: child.name,
    value: mapNode(child, idx, imports, diagnostics, stubNameFor),
  }));
  const schemaCode = printObject(schemaProps);

  const formOptionProps: TsProp[] = [];
  if (project.formValidators.length) {
    imports.add("@modyra/core", "crossField");
    formOptionProps.push({ key: "validators", value: printArray(project.formValidators.map((fv) => mapFormValidator(fv, idx))) });
  }
  if (project.behaviors.draft) {
    const draft = project.behaviors.draft;
    const draftProps: TsProp[] = [{ key: "key", value: literalCode(draft.key) }];
    if (draft.exclude?.length) {
      draftProps.push({ key: "exclude", value: literalCode(draft.exclude.map((r) => idx.pathByNode.get(r.nodeId) ?? r.nodeId)) });
    }
    formOptionProps.push({ key: "draft", value: printObject(draftProps) });
  }
  formOptionProps.push({ key: "history", value: "true" });

  imports.add("@modyra/core", "createForm");
  // Only stub names actually referenced in the emitted schema/options code get imported —
  // a stub declared in the project but never wired to a validator/behavior stays unused here
  // (the P8 "no unused imports" gate applies to stub imports too, not just @modyra/core ones).
  const emitted = schemaCode + "\n" + formOptionProps.map((p) => p.value).join("\n");
  const referencedNames = new Set([...emitted.matchAll(/\b[A-Za-z_$][A-Za-z0-9_$]*\b/g)].map((m) => m[0]));
  const referencedStubs = [...new Set(stubNameFor.values())].filter((name) => referencedNames.has(name));
  if (referencedStubs.length) imports.add("./stubs.js", ...referencedStubs);

  const code = `${imports.print()}\n\nconst schema = ${schemaCode};\n\nexport const form = createForm(schema, ${printObject(formOptionProps)});\n`;
  return { code, diagnostics };
}
