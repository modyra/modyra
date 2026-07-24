/**
 * Plan section 10 "Target scopes: Contract: Contract JSON, Studio JSON" —
 * the smallest legitimate real target: no framework code generation at
 * all, just the project's own canonical serialization plus the compiled
 * Contract v2 (reusing studio-contract's compiler, never reimplementing
 * it). A genuine first target for the platform (P7), not a throwaway.
 */
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
};

export function createJsonTarget(): StudioTarget<JsonTargetOptions> {
  return {
    id: "json",
    displayName: "Contract + Studio JSON",
    version: "0.1.0",
    capabilities: CAPABILITIES,
    defaults(): JsonTargetOptions {
      return { pretty: true };
    },
    async analyze(project: MdyStudioProject): Promise<TargetAnalysis> {
      const { diagnostics } = compileToContract(project);
      return { compatible: !diagnostics.some((d) => d.severity === "error"), diagnostics };
    },
    async generate(project: MdyStudioProject, options: JsonTargetOptions): Promise<Artifact> {
      const projectJson = serializeProject(project);
      const { contract, diagnostics } = compileToContract(project);
      const contractJson = contract ? JSON.stringify(contract, null, options.pretty ? 2 : 0) : null;

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
