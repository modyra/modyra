/**
 * Command engine contract (plan section 7; ADR .modyra/studio/adr/0003-command-engine.md).
 * Every project mutation is a Command: validate before apply, apply is pure,
 * inverse is computed from the pre-apply project so undo is exact.
 */
import type { MdyStudioProject, StudioDiagnostic } from "@modyra/studio-model";

export interface Command {
  readonly kind: string;
  readonly description: string;
  readonly affectedIds: string[];
  /** Diagnostics that block `apply` (empty = allowed). Never mutates `project`. */
  validate(project: MdyStudioProject): StudioDiagnostic[];
  /** Pure: returns a new project, never mutates its argument. */
  apply(project: MdyStudioProject): MdyStudioProject;
  /** `project` is the state immediately BEFORE this command's `apply` ran. */
  inverse(project: MdyStudioProject): Command;
}

export type Placement =
  | { kind: "before"; targetId: string }
  | { kind: "after"; targetId: string }
  | { kind: "inside"; parentId: string; index: number }
  | { kind: "arrayItem"; arrayId: string };
