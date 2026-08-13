/**
 * File field widget types.
 *
 * What a file field holds is a selection, and what a person hands it is a set of candidates —
 * dropped, or picked from the platform's dialog. Between the two sits a policy: which candidates the
 * field accepts, how many, and how large.
 *
 * The rejected ones are part of the state on purpose. A field that silently drops what it would not
 * take leaves someone looking at a list missing the file they just chose, with nothing to explain it.
 */
import type { MdyFieldHandle, MdyInteractivity } from "@modyra/core";
import type { MdyFileCandidate } from "../behavior.js";

export type { MdyFileCandidate };

export interface MdyFileFieldControllerOptions<TFile extends MdyFileCandidate> {
  readonly widgetId: string;
  readonly handle: MdyFieldHandle<readonly TFile[]>;
  /** The `accept` vocabulary: extensions, MIME types, or a `type/*` family. */
  readonly accept?: string;
  readonly multiple?: boolean;
  readonly maxFileSize?: number;
  readonly maxFiles?: number;
  readonly readonly?: boolean;
}

export interface MdyFileFieldState<TFile extends MdyFileCandidate> {
  readonly files: readonly TFile[];
  /**
   * What the last selection would not take, and why it is state rather than a return value.
   *
   * A renderer shows it; a field that drops candidates silently leaves a person looking for a file
   * that is not there. Cleared by the next selection, not by time.
   */
  readonly rejected: readonly TFile[];
  /** Whether something is being dragged over the dropzone right now. */
  readonly dragover: boolean;
  readonly invalid: boolean;
  readonly disabled: boolean;
  readonly interactivity: MdyInteractivity;
  readonly readonly: boolean;
  readonly required: boolean;
  readonly touched: boolean;
  readonly dirty: boolean;
  readonly pending: boolean;
}

export type MdyFileFieldIntent<TFile extends MdyFileCandidate> =
  /** Candidates from the platform's dialog or from a drop. */
  | { readonly type: "select"; readonly files: readonly TFile[] }
  | { readonly type: "clear" }
  /** The pointer entered or left the dropzone while carrying something. */
  | { readonly type: "dragover"; readonly over: boolean }
  | { readonly type: "focus" }
  | { readonly type: "blur" };
