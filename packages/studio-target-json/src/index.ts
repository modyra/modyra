import { serializeProject, type MdyStudioProject } from "@modyra/studio-model";
import { compileToContract } from "@modyra/studio-contract";
import type { Artifact, StudioTarget, TargetAnalysis, TargetCapabilities, TargetManifest } from "@modyra/studio-codegen";

export interface JsonTargetOptions {
  pretty: boolean;
}

const CAPABILITIES: TargetCapabilities = {
  fieldKinds: ["text", "textarea", "email", "number", "checkbox", "select", "multiselect", "date"],
  validatorKinds: ["required", "email", "min", "max", "minLength", "maxLength", "pattern"],
  supportsArrays: true,
  supportsGroups: true,
  supportsServerValidators: false,
  supportsFormValidators: false,
  // The one target that carries an arrangement: it serialises the whole contract, and `layout` is
  // part of the contract. The code targets emit a form module and no markup, and say so.
  supportsLayout: true,
};

const JSON_TARGET_DEFAULTS: JsonTargetOptions = { pretty: true };

export function createJsonTarget(): StudioTarget<JsonTargetOptions> {
  return {
    id: "json",
    displayName: "Contract + Studio JSON",
    version: "0.1.0",
    capabilities: CAPABILITIES,
    defaults(): JsonTargetOptions {
      return { ...JSON_TARGET_DEFAULTS };
    },
    async analyze(project: MdyStudioProject): Promise<TargetAnalysis> {
      const { diagnostics } = compileToContract(project);
      return { compatible: !diagnostics.some((d) => d.severity === "error"), diagnostics };
    },
    async generate(project: MdyStudioProject, options?: Partial<JsonTargetOptions>): Promise<Artifact> {
      // A target answers with what it declared. `defaults()` is public and says `pretty: true`, and
      // this read `options.pretty` off whatever it was handed — so a host iterating the registry the
      // same way worked for three targets and raised on the fourth, which is a difference in
      // interface rather than in output. The other three ignore options entirely; honouring one's
      // own defaults is the version of that which still lets a caller choose.
      const { pretty } = { ...JSON_TARGET_DEFAULTS, ...options };
      const projectJson = serializeProject(project);
      const { contract, diagnostics } = compileToContract(project);
      const contractJson = contract ? JSON.stringify(contract, null, pretty ? 2 : 0) : null;

      const files: Artifact["files"] = [
        { path: "project.mdy-studio.json", language: "json", content: projectJson, role: "source" },
        ...(contractJson ? [{ path: "contract.json", language: "json", content: contractJson, role: "source" as const }] : []),
      ];

      return {
        targetId: "json",
        files,
        diagnostics,
        entryFile: contractJson ? "contract.json" : "project.mdy-studio.json",
      };
    },
  };
}

export const jsonTargetManifest: TargetManifest = {
  id: "json",
  displayName: "Contract + Studio JSON",
  load: async () => createJsonTarget(),
};
