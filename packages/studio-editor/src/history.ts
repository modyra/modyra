/**
 * Minimal undo/redo stack (plan section 7 Do-list: "history"). Thin on
 * purpose — P3/P4 wire this to UI/keyboard; this batch only needs the
 * apply/inverse contract to be exercisable and reversible.
 */
import type { MdyStudioProject, StudioDiagnostic } from "@modyra/studio-model";
import type { Command } from "./types.js";

export class CommandRejectedError extends Error {
  readonly command: Command;
  readonly diagnostics: StudioDiagnostic[];

  constructor(command: Command, diagnostics: StudioDiagnostic[]) {
    super(`Command "${command.kind}" rejected: ${diagnostics.map((d) => d.message).join("; ")}`);
    this.name = "CommandRejectedError";
    this.command = command;
    this.diagnostics = diagnostics;
  }
}

interface HistoryEntry {
  command: Command;
  inverse: Command;
}

export class CommandHistory {
  #undoStack: HistoryEntry[] = [];
  #redoStack: HistoryEntry[] = [];

  /** Validates, computes the inverse against the pre-apply project, applies, then records both. */
  apply(project: MdyStudioProject, command: Command): MdyStudioProject {
    const diagnostics = command.validate(project);
    if (diagnostics.some((d) => d.severity === "error")) {
      throw new CommandRejectedError(command, diagnostics);
    }
    const inverse = command.inverse(project);
    const next = command.apply(project);
    this.#undoStack.push({ command, inverse });
    this.#redoStack = [];
    return next;
  }

  canUndo(): boolean {
    return this.#undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.#redoStack.length > 0;
  }

  undo(project: MdyStudioProject): MdyStudioProject {
    const entry = this.#undoStack.pop();
    if (!entry) return project;
    const next = entry.inverse.apply(project);
    this.#redoStack.push(entry);
    return next;
  }

  redo(project: MdyStudioProject): MdyStudioProject {
    const entry = this.#redoStack.pop();
    if (!entry) return project;
    const next = entry.command.apply(project);
    this.#undoStack.push(entry);
    return next;
  }
}
