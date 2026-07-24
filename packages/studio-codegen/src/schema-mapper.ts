/**
 * Shared "form.ts" builder for every real-code target — plan section 10's
 * "Shared TS IR factory: createForm | mdyForm | useMdyForm". Every Studio
 * validator kind maps to a real @modyra/core validator function (not a
 * reimplementation), server validation uses the idiomatic `serverValidator()`
 * helper (matches real usage, e.g. examples/angular's typed-form section),
 * and form-level validators compile through `compileExpressionToJs`
 * (ADR-0005: portable expression -> real source). Only the schema-factory
 * import source and call name vary per target — that is `TargetProfile`.
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
import { compileExpressionToJs } from "./expression-compiler.js";
import { ImportResolver } from "./import-resolver.js";
import { printArray, printCall, printObject, printRegExp, printString, type TsProp } from "./ts-print.js";

export interface FormModuleResult {
  code: string;
  diagnostics: StudioDiagnostic[];
}

/** The only things that differ between Core/Angular/React targets: where the schema factory comes from and what the create-call is named. */
export interface TargetProfile {
  readonly factoryImportSource: string;
  readonly createCallName: string;
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

/** `serverValidator()`'s `when` receives the field's own value as its first argument — only usable when `skipWhen` refers to that same field, never a sibling (that would need the whole form value, a different calling convention). */
function mapSkipWhen(expr: StudioExpression, fieldId: string, fieldName: string, diagnostics: StudioDiagnostic[]): string | null {
  const refs: string[] = [];
  collectRefs(expr, refs);
  if (refs.some((id) => id !== fieldId)) {
    diagnostics.push({
      code: "UNSUPPORTED_SKIP_WHEN",
      severity: "warning",
      message: `skipWhen on "${fieldName}" references another field; this target only supports self-referencing skipWhen, so it was omitted`,
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
      diagnostics.push({ code: "UNSUPPORTED_VALIDATOR", severity: "warning", message: `Validator kind "${v.kind}" is not supported by this target and was omitted`, nodeId: node.id, validatorId: v.id });
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
  diagnostics.push({ code: "UNSUPPORTED_VALIDATOR", severity: "warning", message: `Array validator kind "${v.kind}" is not supported by this target and was omitted`, nodeId: node.id, validatorId: v.id });
  return null;
}

/** The field()'s 3rd-arg `MdyFieldOptions` expression, built via the idiomatic `serverValidator()` helper (returns a ready-to-spread options fragment — never hand-built asyncValidators/asyncDebounceMs). */
function mapServerValidatorArg(node: FieldNode, idx: StudioIndexes, imports: ImportResolver, diagnostics: StudioDiagnostic[], stubNameFor: Map<string, string>): string | null {
  const sv = node.serverValidator;
  if (!sv) return null;
  const stubName = stubNameFor.get(sv.implementationRef);
  if (!stubName) {
    diagnostics.push({ code: "MISSING_IMPLEMENTATION", severity: "error", message: `Server validator on "${node.name}" has no resolvable implementation`, nodeId: node.id, validatorId: sv.id });
    return null;
  }
  imports.add("@modyra/core", "serverValidator");
  const optionProps: TsProp[] = [];
  if (sv.debounceMs !== undefined) optionProps.push({ key: "debounceMs", value: literalCode(sv.debounceMs) });
  if (sv.dependencies.length) {
    // dependsOn wants dotted form-value paths, never internal Studio node IDs.
    optionProps.push({ key: "dependsOn", value: literalCode(sv.dependencies.map((d) => idx.pathByNode.get(d.nodeId) ?? d.nodeId)) });
  }
  if (sv.timeoutMs !== undefined) optionProps.push({ key: "timeoutMs", value: literalCode(sv.timeoutMs) });
  if (sv.skipWhen) {
    const when = mapSkipWhen(sv.skipWhen, node.id, node.name, diagnostics);
    if (when) optionProps.push({ key: "when", value: `(value) => (${when})` });
  }
  return printCall("serverValidator", optionProps.length ? [stubName, printObject(optionProps)] : [stubName]);
}

function mapField(node: FieldNode, idx: StudioIndexes, imports: ImportResolver, diagnostics: StudioDiagnostic[], stubNameFor: Map<string, string>, profile: TargetProfile): string {
  imports.add(profile.factoryImportSource, "field");
  const validatorCodes = node.validators
    .map((v) => mapFieldValidator(v, node, imports, diagnostics, stubNameFor))
    .filter((c): c is string => c !== null);
  const serverValidatorArg = mapServerValidatorArg(node, idx, imports, diagnostics, stubNameFor);

  const args = [literalCode(node.initialValue)];
  if (validatorCodes.length || serverValidatorArg) args.push(printArray(validatorCodes));
  if (serverValidatorArg) args.push(serverValidatorArg);
  return printCall("field", args);
}

function mapGroup(node: GroupNode, idx: StudioIndexes, imports: ImportResolver, diagnostics: StudioDiagnostic[], stubNameFor: Map<string, string>, profile: TargetProfile): string {
  imports.add(profile.factoryImportSource, "group");
  const props: TsProp[] = node.children.map((child) => ({ key: child.name, value: mapNode(child, idx, imports, diagnostics, stubNameFor, profile) }));
  return printCall("group", [printObject(props)]);
}

function mapArray(node: ArrayNode, idx: StudioIndexes, imports: ImportResolver, diagnostics: StudioDiagnostic[], stubNameFor: Map<string, string>, profile: TargetProfile): string {
  imports.add(profile.factoryImportSource, "array");
  const itemCode = mapNode(node.item, idx, imports, diagnostics, stubNameFor, profile);
  const validatorCodes = node.validators
    .map((v) => mapArrayValidator(v, node, imports, diagnostics))
    .filter((c): c is string => c !== null);

  const optionProps: TsProp[] = [{ key: "initial", value: literalCode(node.initialRows) }];
  if (validatorCodes.length) optionProps.push({ key: "validators", value: printArray(validatorCodes) });
  return printCall("array", [itemCode, printObject(optionProps)]);
}

function mapNode(node: StudioSchemaNode, idx: StudioIndexes, imports: ImportResolver, diagnostics: StudioDiagnostic[], stubNameFor: Map<string, string>, profile: TargetProfile): string {
  if (node.node === "field") return mapField(node, idx, imports, diagnostics, stubNameFor, profile);
  if (node.node === "group") return mapGroup(node, idx, imports, diagnostics, stubNameFor, profile);
  return mapArray(node, idx, imports, diagnostics, stubNameFor, profile);
}

function mapFormValidator(fv: StudioFormValidator, idx: StudioIndexes): string {
  const pathOf = (id: string): string => idx.pathByNode.get(id) ?? id;
  const condition = compileExpressionToJs(fv.condition, pathOf);
  const targetRefs = fv.errorTarget ? [fv.errorTarget] : fv.dependencies;
  const paths = targetRefs.map((r) => pathOf(r.nodeId)).filter((p) => p !== "");
  return `crossField(${literalCode(paths)}, (value) => (${condition}) ? null : ${literalCode(fv.message)})`;
}

/** Builds `form.ts` for the given target `profile`. `stubNameFor` maps implementationRef id -> the generated stub function name. */
export function buildFormModule(project: MdyStudioProject, stubNameFor: Map<string, string>, profile: TargetProfile): FormModuleResult {
  const diagnostics: StudioDiagnostic[] = [];
  const imports = new ImportResolver();

  if (project.schema.node !== "group") {
    diagnostics.push({ code: "INVALID_ROOT", severity: "error", message: "Project schema root must be a group", nodeId: project.schema.id });
    return { code: "", diagnostics };
  }

  const idx = buildIndexes(project);
  const schemaProps: TsProp[] = project.schema.children.map((child) => ({
    key: child.name,
    value: mapNode(child, idx, imports, diagnostics, stubNameFor, profile),
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

  imports.add(profile.factoryImportSource, profile.createCallName);
  // Only stub names actually referenced in the emitted schema/options code get imported —
  // a stub declared in the project but never wired to a validator/behavior stays unused here
  // (the "no unused imports" gate applies to stub imports too, not just factory ones).
  const emitted = schemaCode + "\n" + formOptionProps.map((p) => p.value).join("\n");
  const referencedNames = new Set([...emitted.matchAll(/\b[A-Za-z_$][A-Za-z0-9_$]*\b/g)].map((m) => m[0]));
  const referencedStubs = [...new Set(stubNameFor.values())].filter((name) => referencedNames.has(name));
  if (referencedStubs.length) imports.add("./stubs.js", ...referencedStubs);

  const code = `${imports.print()}\n\nconst schema = ${schemaCode};\n\nexport const form = ${profile.createCallName}(schema, ${printObject(formOptionProps)});\n`;
  return { code, diagnostics };
}
