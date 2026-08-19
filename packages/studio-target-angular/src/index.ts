import {
  buildFormModule,
  arrangementDiagnostics,
  capabilityDiagnostics,
  buildStubsModule,
  type Artifact,
  type ArtifactFile,
  type StudioTarget,
  type TargetAnalysis,
  type TargetCapabilities,
  type TargetManifest,
} from "@modyra/studio-codegen";
import { compileToContract } from "@modyra/studio-contract";
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
  // This target emits a form module and no markup, so an arranged project loses its
  // arrangement here. Reported rather than dropped in silence.
  // A project the contract compiler cannot express is a fact about the project rather than about the
  // one target that happens to ask: a field kind the catalog does not declare is an error there, and
  // a target that never asks answers `compatible: true` for it.
  //
  // Errors only. The compiler's warnings are about the *contract document* it is building — a server
  // validator with no Contract v2 equivalent is omitted from that document and carried into this
  // target's own output — so repeating them here would tell an author something was dropped that
  // this target emits.
  const diagnostics = [
    ...stubsResult.diagnostics,
    ...formResult.diagnostics,
    ...compileToContract(project).diagnostics.filter((d) => d.severity === "error"),
    ...arrangementDiagnostics(project, { id: "angular", capabilities: CAPABILITIES }),
    ...capabilityDiagnostics(project, { id: "angular", capabilities: CAPABILITIES }),
  ];

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
