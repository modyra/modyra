/**
 * What a target loses when it cannot express an arrangement.
 *
 * A Studio project keeps its arrangement in `presentation.layout`: sections, and rows divided into
 * columns, authored per breakpoint. The JSON target carries it, because it serialises the whole
 * contract. The code targets emit a form *module* — a schema, its validators and the stubs they
 * reference — and no markup at all, so there is nowhere for an arrangement to go.
 *
 * That is a reasonable thing for a target to be. Losing the work silently is not: a form arranged
 * over four breakpoints exports as a flat schema with nothing said about it, and the first time
 * anyone finds out is when they render it. So the loss is reported as a diagnostic — the same
 * channel every other target limitation already uses — naming what was dropped, how much of it, and
 * where the arrangement still exists.
 */
import type { MdyStudioProject, StudioDiagnostic } from "@modyra/studio-model";
import type { TargetCapabilities } from "./types.js";

/** Every node in a layout tree, so the count reported is the work done rather than the top level. */
function countNodes(nodes: ReadonlyArray<unknown>): number {
  let total = 0;
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    total += 1;
    const record = node as { children?: ReadonlyArray<unknown>; columns?: ReadonlyArray<ReadonlyArray<unknown>> };
    if (Array.isArray(record.children)) total += countNodes(record.children);
    if (Array.isArray(record.columns)) for (const column of record.columns) total += countNodes(column);
  }
  return total;
}

/**
 * One `info` diagnostic when a project has an arrangement its target cannot express, and nothing at
 * all otherwise — a target that expresses layout, or a project with none, has nothing to report.
 *
 * `info` rather than `warning`: nothing is wrong, and a target that cannot draw is not a target that
 * failed. It must not make a project incompatible, so `analyze` keeps working the way it does today.
 */
export function arrangementDiagnostics(
  project: MdyStudioProject,
  target: { readonly id: string; readonly capabilities: TargetCapabilities },
): StudioDiagnostic[] {
  if (target.capabilities.supportsLayout) return [];
  const layout = project.presentation?.layout ?? [];
  if (layout.length === 0) return [];
  const nodes = countNodes(layout);
  return [
    {
      code: "LAYOUT_NOT_EXPRESSED",
      severity: "info",
      targetId: target.id,
      propertyPath: "presentation.layout",
      message:
        `This target emits a form module and no markup, so the arrangement (${nodes} layout ` +
        `node${nodes === 1 ? "" : "s"}) is not carried into the generated code. The JSON target ` +
        `exports it with the contract; \`layoutNodeAttributes\` and \`layoutSlotStyle\` in ` +
        `@modyra/widgets apply it to your own markup.`,
    },
  ];
}
