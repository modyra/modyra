/**
 * Plan section 10 "React MVP: useMdyForm definition" — reuses
 * studio-codegen's shared schema mapper (P8a) with the React profile:
 * `field`/`group`/`array`/`useMdyForm`/validators all come from
 * `@modyra/react` (a single import source — unlike Angular's split
 * `@modyra/angular/adapter` + `@modyra/core` — see examples/react's own
 * signup form for the same pattern). Two React-specific corrections a
 * bare TargetProfile swap would have missed:
 *
 * - `useMdyForm(schema, options)` takes `schema: () => S`, a thunk, not a
 *   bare object (`wrapSchemaInThunk`).
 * - `useMdyForm` is a React Hook: calling it at module scope like
 *   `createForm`/`mdyForm` would violate the Rules of Hooks. The output
 *   exports a wrapping `useCheckoutForm()`-style hook instead of a bare
 *   `const form` (`hookExportName`).
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

const REACT_PROFILE = {
  factoryImportSource: "@modyra/react",
  createCallName: "useMdyForm",
  wrapSchemaInThunk: true,
  hookExportName: "useForm",
  validatorsImportSource: "@modyra/react",
};

export interface ReactTargetOptions {
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
  const formResult = buildFormModule(project, stubsResult.nameFor, REACT_PROFILE);
  const diagnostics = [...stubsResult.diagnostics, ...formResult.diagnostics];

  if (!formResult.code) return { files: [], diagnostics };

  const files: ArtifactFile[] = [
    { path: "form.ts", language: "typescript", content: formResult.code, role: "source" },
    { path: "stubs.ts", language: "typescript", content: stubsResult.code, role: "source" },
  ];
  return { files, diagnostics };
}

export function createReactTarget(): StudioTarget<ReactTargetOptions> {
  return {
    id: "react",
    displayName: "React (useMdyForm)",
    version: "0.1.0",
    capabilities: CAPABILITIES,
    defaults(): ReactTargetOptions {
      return {};
    },
    async analyze(project: MdyStudioProject): Promise<TargetAnalysis> {
      const { diagnostics } = generateFiles(project);
      return { compatible: !diagnostics.some((d) => d.severity === "error"), diagnostics };
    },
    async generate(project: MdyStudioProject): Promise<Artifact> {
      const { files, diagnostics } = generateFiles(project);
      return { targetId: "react", files, diagnostics, entryFile: files.length ? "form.ts" : undefined };
    },
  };
}

export const reactTargetManifest: TargetManifest = {
  id: "react",
  displayName: "React (useMdyForm)",
  load: async () => createReactTarget(),
};
