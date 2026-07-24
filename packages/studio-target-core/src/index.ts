/**
 * Plan section 10 "Core: definition, stubs, submit example" — the first
 * target that emits a real, runnable @modyra/core form: `form.ts` (a
 * genuine `createForm()` schema, not a description of one), `stubs.ts`
 * (typed, throwing placeholders for every symbolic ImplementationRef —
 * ADR-0005, R7, R11), and, when the project declares a submit action,
 * `submit-example.ts` showing it wired to `form.submit()`.
 */
import { buildStubsModule, type Artifact, type ArtifactFile, type StudioTarget, type TargetAnalysis, type TargetCapabilities, type TargetManifest } from "@modyra/studio-codegen";
import type { MdyStudioProject, StudioDiagnostic } from "@modyra/studio-model";
import { buildFormModule } from "./field-mapper.js";

export interface CoreTargetOptions {
  readonly pretty?: boolean;
}

const CAPABILITIES: TargetCapabilities = {
  fieldKinds: ["text", "textarea", "email", "number", "checkbox", "select", "multiselect", "date"],
  validatorKinds: ["required", "email", "min", "max", "minLength", "maxLength", "pattern", "oneOf", "eachOneOf", "customRef"],
  supportsArrays: true,
  supportsGroups: true,
  supportsServerValidators: true,
  supportsFormValidators: true,
};

function buildSubmitExample(project: MdyStudioProject, stubNameFor: Map<string, string>): string | null {
  const submitRef = project.behaviors.submit?.implementationRef;
  const stubName = submitRef ? stubNameFor.get(submitRef) : undefined;
  if (!stubName) return null;
  return `import { form } from "./form.js";\nimport { ${stubName} } from "./stubs.js";\n\nform.submit(${stubName});\n`;
}

function generateFiles(project: MdyStudioProject): { files: ArtifactFile[]; diagnostics: StudioDiagnostic[] } {
  const stubsResult = buildStubsModule(project);
  const formResult = buildFormModule(project, stubsResult.nameFor);
  const diagnostics = [...stubsResult.diagnostics, ...formResult.diagnostics];

  if (!formResult.code) return { files: [], diagnostics };

  const files: ArtifactFile[] = [
    { path: "form.ts", language: "typescript", content: formResult.code, role: "source" },
    { path: "stubs.ts", language: "typescript", content: stubsResult.code, role: "source" },
  ];
  const submitCode = buildSubmitExample(project, stubsResult.nameFor);
  if (submitCode) files.push({ path: "submit-example.ts", language: "typescript", content: submitCode, role: "docs" });

  return { files, diagnostics };
}

export function createCoreTarget(): StudioTarget<CoreTargetOptions> {
  return {
    id: "core",
    displayName: "Core (createForm)",
    version: "0.1.0",
    capabilities: CAPABILITIES,
    defaults(): CoreTargetOptions {
      return {};
    },
    async analyze(project: MdyStudioProject): Promise<TargetAnalysis> {
      const { diagnostics } = generateFiles(project);
      return { compatible: !diagnostics.some((d) => d.severity === "error"), diagnostics };
    },
    async generate(project: MdyStudioProject): Promise<Artifact> {
      const { files, diagnostics } = generateFiles(project);
      return { targetId: "core", files, diagnostics, entryFile: files.length ? "form.ts" : undefined };
    },
  };
}

export const coreTargetManifest: TargetManifest = {
  id: "core",
  displayName: "Core (createForm)",
  load: async () => createCoreTarget(),
};
