/**
 * File field controller.
 *
 * A file field holds a selection; a person hands it candidates. Between the two sits a policy — what
 * is accepted, how many, how large — and that policy is `fileSelectionTransition`, which already
 * existed and which every renderer wired by hand along with the state around it.
 *
 * The state around it is the part worth having here. What was **rejected** has to survive the
 * transition long enough to be shown: a field that silently drops what it will not take leaves
 * someone looking at a list missing the file they just chose, with nothing to explain it. And
 * `dragover` is a state the contract declares, so it belongs to the widget rather than to whichever
 * renderer remembered to track it.
 */
import { observerFor, type MdyReactivity, type MdySignal } from "@modyra/core";
import { clearFileSelection, fileSelectionTransition, type MdyFileCandidate } from "../behavior.js";
import { MDY_WIDGET_CONTRACTS } from "../catalog.js";
import type { MdyUiCommand } from "../commands.js";
import type { MdyWidgetController, MdyWidgetViewContract } from "../contract.js";
import { blocksValueChange } from "../interactivity.js";
import { fieldShellRootClasses, projectFieldShellA11y } from "./shell-a11y.js";
import type {
  MdyFileFieldControllerOptions,
  MdyFileFieldIntent,
  MdyFileFieldState,
} from "./file-field-types.js";
import { engageValue, errorsVisible, holdsUneditedValue, showsAsInvalid } from "./verdict.js";

export interface MdyFileFieldController<TFile extends MdyFileCandidate>
  extends MdyWidgetController<MdyFileFieldState<TFile>, MdyFileFieldIntent<TFile>> {
  setValue(files: readonly TFile[]): void;
  setReadonly(readonly: boolean): void;
}

export function createFileFieldController<TFile extends MdyFileCandidate>(
  options: MdyFileFieldControllerOptions<TFile>,
  reactivity?: MdyReactivity,
): MdyFileFieldController<TFile> {
  reactivity = observerFor(options.handle, reactivity);
  const { widgetId, handle, readonly: initialReadonly = false } = options;
  const policy = {
    accept: options.accept,
    multiple: options.multiple ?? false,
    maxFileSize: options.maxFileSize,
    maxFiles: options.maxFiles,
  };

  const readonly = reactivity.signal(initialReadonly);
  const rejected = reactivity.signal<readonly TFile[]>([]);
  const dragover = reactivity.signal(false);

  const state: MdySignal<MdyFileFieldState<TFile>> = reactivity.computed(() => ({
    files: handle.value() ?? [],
    rejected: rejected(),
    dragover: dragover(),
    // Out of play, no verdict. See verdict.ts.
    invalid: showsAsInvalid({ valid: handle.valid(), disabled: handle.disabled() }),
    disabled: handle.disabled(),
    readonly: handle.readonly() || readonly(),
    interactivity: handle.interactivity() === "enabled" && readonly()
      ? ("readonly" as const)
      : handle.interactivity(),
    required: handle.required(),
    touched: handle.touched(),
    dirty: handle.dirty(),
    pending: handle.pending(),
  }));

  const view: MdySignal<MdyWidgetViewContract> = reactivity.computed(() => {
    const current = state();
    const shell = projectFieldShellA11y(current, handle.errors(), {
      widgetId,
      kind: "file",
      // What is shown, not what is wrong: `aria-invalid` and the error list answer one question, and
      // a rule nobody has answered yet is not news until the person has been at the field.
      errorsVisible: errorsVisible({ disabled: current.disabled, touched: current.touched, holdsUnedited: holdsUneditedValue(current, "file") }, handle.errors()),
    });
    const definition = MDY_WIDGET_CONTRACTS.file;
    return {
      root: { classes: fieldShellRootClasses(current as unknown as Readonly<Record<string, unknown>>), attributes: {} },
      parts: {
        label: shell.label,
        control: shell.control,
        description: shell.description,
        error: shell.error,
        dropzone: {
          classes: [
            ...definition.parts.dropzone.classes,
            // The state the contract declares for this part, painted from the widget rather than
            // from whichever renderer remembered to track the drag.
            ...(current.dragover ? ["mdy-file__dropzone--dragover"] : []),
          ],
          attributes: { "aria-disabled": String(current.disabled) },
        },
        fileList: {
          classes: [...definition.parts.fileList.classes],
          // Announced as it changes: a file that was accepted is something that happened, and a list
          // that updates in silence tells a screen-reader user nothing. What was *refused* never
          // reaches this list — it is the `rejected` part that carries it.
          attributes: { role: "list", "aria-live": "polite" },
        },
      },
    };
  });

  function dispatch(intent: MdyFileFieldIntent<TFile>): readonly MdyUiCommand[] {
    // A leaving is not an answer. Focus arriving and going is an act on attention: Tab is how a
    // person reads a form, and a form that treats reading as declining moves false news onto the
    // fields somebody was about to fill in. What makes this field answerable is a change to its
    // value, which `engageValue` records. ADR 0167.
    if (intent.type === "blur") return [];
    if (intent.type === "focus") return [];

    if (intent.type === "dragover") {
      // Tracked even when the field cannot take a drop: the dropzone still has to stop showing itself
      // as receptive when the pointer leaves, and a disabled field that keeps the highlight is worse
      // than one that never lit up.
      dragover.set(intent.over && !blocksValueChange(state().interactivity));
      return [];
    }

    if (blocksValueChange(state().interactivity)) return [];

    if (intent.type === "clear") {
      const cleared = clearFileSelection<TFile>();
      rejected.set([]);
      dragover.set(false);
      handle.set((cleared.value ?? []) as readonly TFile[]);
      engageValue(handle);
      return [{ type: "mark-dirty" }, { type: "mark-touched" }];
    }

    const next = fileSelectionTransition(intent.files, policy);
    dragover.set(false);
    // Replaced, not accumulated: what the last selection refused is what a renderer shows now, and
    // keeping the previous round's refusals would explain a file the person never offered.
    rejected.set(next.rejected);
    // `undefined` means nothing was accepted, which preserves what is held rather than clearing it.
    if (next.value === undefined) return [];

    handle.set((Array.isArray(next.value) ? next.value : [next.value]) as readonly TFile[]);
    engageValue(handle);
    // Both flags are set by `engageValue` above: one act, two flags. This decides only whether the
    // host is told about the second.
    const commands: MdyUiCommand[] = [{ type: "mark-dirty" }];
    if (next.touched) commands.push({ type: "mark-touched" });
    return commands;
  }

  function setValue(files: readonly TFile[]): void {
    handle.set(files);
    rejected.set([]);
  }

  function setReadonly(nextReadonly: boolean): void {
    readonly.set(nextReadonly);
  }

  function destroy(): void {
    dragover.set(false);
    rejected.set([]);
  }

  return { state, view, dispatch, setValue, setReadonly, destroy };
}
