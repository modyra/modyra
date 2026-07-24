/**
 * Plan section 10 "Angular MVP: mdyForm definition" — reuses studio-codegen's
 * shared schema mapper (P8a) with the Angular profile: `field`/`group`/
 * `array`/`mdyForm` from `@modyra/angular/adapter` instead of `createForm`
 * from `@modyra/core` (validators/crossField/serverValidator still come
 * from `@modyra/core` either way — see examples/angular's own typed-form
 * section for the same import split). Narrower scope than the Core target
 * (P8): definition + stubs only, no submit example, per the plan.
 */
import {
  buildFormModule,
  buildStubsModule,
  type Artifact,
  type ArtifactFile,
  type StudioTarget,
  type TargetAnalysis,
  type TargetCapabilities,
  type TargetManifest,
} from "@modyra/studio-codegen";
import type { MdyStudioProject, StudioDiagnostic } from "@modyra/studio-model";

const ANGULAR_PROFILE = { factoryImportSource: "@modyra/angular/adapter", createCallName: "mdyForm" };

export interface AngularTargetOptions {
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

function generateFiles(project: MdyStudioProject): { files: ArtifactFile[]; diagnostics: StudioDiagnostic[] } {
  const stubsResult = buildStubsModule(project);
  const formResult = buildFormModule(project, stubsResult.nameFor, ANGULAR_PROFILE);
  const diagnostics = [...stubsResult.diagnostics, ...formResult.diagnostics];

  if (!formResult.code) return { files: [], diagnostics };

  const files: ArtifactFile[] = [
    { path: "form.ts", language: "typescript", content: formResult.code, role: "source" },
    { path: "stubs.ts", language: "typescript", content: stubsResult.code, role: "source" },
  ];
  return { files, diagnostics };
}

export function createAngularTarget(): StudioTarget<AngularTargetOptions> {
  return {
    id: "angular",
    displayName: "Angular (mdyForm)",
    version: "0.1.0",
    capabilities: CAPABILITIES,
    defaults(): AngularTargetOptions {
      return {};
    },
    async analyze(project: MdyStudioProject): Promise<TargetAnalysis> {
      const { diagnostics } = generateFiles(project);
      return { compatible: !diagnostics.some((d) => d.severity === "error"), diagnostics };
    },
    async generate(project: MdyStudioProject): Promise<Artifact> {
      const { files, diagnostics } = generateFiles(project);
      return { targetId: "angular", files, diagnostics, entryFile: files.length ? "form.ts" : undefined };
    },
  };
}

export const angularTargetManifest: TargetManifest = {
  id: "angular",
  displayName: "Angular (mdyForm)",
  load: async () => createAngularTarget(),
};
