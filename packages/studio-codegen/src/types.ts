/**
 * Target plugin API (plan section 10; ADR
 *. A target only ever reads
 * MdyStudioProject and produces an Artifact — it never depends on
 * studio-model/studio-editor/studio-ui internals beyond this contract, and
 * the editor only ever holds a lazy TargetManifest until generate() is
 * actually invoked (: target = lazy plugin).
 */
import type { MdyStudioProject, StudioDiagnostic } from "@modyra/studio-model";

/** What a target can/can't handle — used to diagnose incompatibility before generating. */
export interface TargetCapabilities {
  fieldKinds: readonly string[];
  validatorKinds: readonly string[];
  supportsArrays: boolean;
  supportsGroups: boolean;
  supportsServerValidators: boolean;
  supportsFormValidators: boolean;
  /**
   * Whether the target carries a project's arrangement (`presentation.layout`) into what it emits.
   *
   * Optional and false by default, because most targets emit a form module and no markup: there is
   * nowhere for an arrangement to go, and saying so is not a defect. What it changes is that the
   * loss is *stated* — `arrangementDiagnostics` reports it rather than letting a form arranged over
   * four breakpoints export as a flat schema with nothing said about it.
   */
  supportsLayout?: boolean;
}

export type ArtifactFileRole = "source" | "test" | "config" | "docs";

export interface ArtifactFile {
  readonly path: string;
  readonly language: string;
  readonly content: string;
  readonly role: ArtifactFileRole;
}

export interface Artifact {
  readonly targetId: string;
  readonly files: readonly ArtifactFile[];
  readonly diagnostics: readonly StudioDiagnostic[];
  readonly entryFile?: string;
}

export interface TargetAnalysis {
  readonly compatible: boolean;
  readonly diagnostics: readonly StudioDiagnostic[];
}

export interface StudioTarget<T = unknown> {
  readonly id: string;
  readonly displayName: string;
  readonly version: string;
  readonly capabilities: TargetCapabilities;
  defaults(): T;
  analyze(project: MdyStudioProject, options: T): Promise<TargetAnalysis>;
  generate(project: MdyStudioProject, options: T): Promise<Artifact>;
}

/** The editor only ever holds these until a target is actually invoked — load() is the one lazy hop. */
export interface TargetManifest {
  readonly id: string;
  readonly displayName: string;
  load(): Promise<StudioTarget>;
}
