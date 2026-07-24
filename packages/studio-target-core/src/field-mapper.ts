/**
 * Thin Core-profile wrapper around studio-codegen's shared schema mapper —
 * `field`/`group`/`array`/`createForm` all come from `@modyra/core`. See
 * studio-codegen/src/schema-mapper.ts for the actual mapping logic, shared
 * with every other real-code target (Angular's `mdyForm` next).
 */
import type { MdyStudioProject } from "@modyra/studio-model";
import { buildFormModule as buildSharedFormModule, type FormModuleResult } from "@modyra/studio-codegen";

const CORE_PROFILE = { factoryImportSource: "@modyra/core", createCallName: "createForm" };

export function buildFormModule(project: MdyStudioProject, stubNameFor: Map<string, string>): FormModuleResult {
  return buildSharedFormModule(project, stubNameFor, CORE_PROFILE);
}
