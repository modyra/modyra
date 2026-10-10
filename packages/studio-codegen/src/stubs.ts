/**
 * Symbolic StudioImplementationRefs (ADR-0005) become real, typed,
 * throwing stub functions — one per ref, named after its displayName — so
 * form.ts and submit-example.ts have something concrete to import. Never
 * inline "logic": the user fills these in (,  — no eval, no
 * generated business logic).
 */
import type { MdyStudioProject, StudioDiagnostic, StudioImplementationRef } from "@modyra/studio-model";
import { isValidBindingName, toBindingName } from "./ts-print.js";

export interface StubsResult {
  code: string;
  /** implementationRef id -> the generated function's identifier. */
  nameFor: Map<string, string>;
  diagnostics: StudioDiagnostic[];
}

function stubBody(role: StudioImplementationRef["role"], name: string): string {
  if (role === "serverValidator") {
    return `export async function ${name}(value: unknown, ctx: MdyAsyncValidationContext): Promise<readonly string[]> {\n  throw new Error("TODO: implement ${name}");\n}`;
  }
  if (role === "submitAction") {
    return `export async function ${name}(value: Record<string, unknown>): Promise<void> {\n  throw new Error("TODO: implement ${name}");\n}`;
  }
  return `export function ${name}(value: unknown): readonly string[] {\n  throw new Error("TODO: implement ${name}");\n}`;
}

/** Builds `stubs.ts` for every implementation ref the project declares — deterministic, sorted by id. */
export function buildStubsModule(project: MdyStudioProject): StubsResult {
  const diagnostics: StudioDiagnostic[] = [];
  const nameFor = new Map<string, string>();
  const impls = Object.values(project.implementations).sort((a, b) => a.id.localeCompare(b.id));
  // The module imports `MdyAsyncValidationContext` as soon as one server-validator stub exists, so no
  // stub may declare that name then; without one the name is free.
  const needsAsyncContextType = impls.some((impl) => impl.role === "serverValidator");
  const usedNames = new Set<string>(needsAsyncContextType ? ["MdyAsyncValidationContext"] : []);
  const blocks: string[] = [];

  for (const impl of impls) {
    let name = isValidBindingName(impl.displayName) ? impl.displayName : toBindingName(impl.displayName);
    if (usedNames.has(name)) {
      const disambiguated = `${name}_${impl.id.slice(-4)}`;
      diagnostics.push({
        code: "STUB_NAME_COLLISION",
        severity: "warning",
        message: `Implementation "${impl.displayName}" collides with another stub name; generated "${disambiguated}" instead`,
        targetId: impl.id,
      });
      name = disambiguated;
    }
    usedNames.add(name);
    nameFor.set(impl.id, name);
    blocks.push(stubBody(impl.role, name));
  }

  const sections = needsAsyncContextType
    ? ['import type { MdyAsyncValidationContext } from "@modyra/core";', ...blocks]
    : blocks;
  return { code: sections.length ? `${sections.join("\n\n")}\n` : "export {};\n", nameFor, diagnostics };
}
