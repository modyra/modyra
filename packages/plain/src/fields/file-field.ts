/**
 * Renders the "file" kind: a native input kept as the real control, a drop zone around it, and the
 * list of what was chosen.
 *
 * Which candidates are acceptable — the accept tokens, `multiple`, the size and count caps — is
 * `fileSelectionTransition` in `@modyra/widgets`; this renderer only turns picks and drops into
 * candidates and draws the outcome.
 */
import { vanillaReactivity, type MdyFieldHandle, type MdyReactivity } from "@modyra/core";
import type { MdyDynamicFileField } from "@modyra/core";
import {
  MDY_WIDGET_CONTRACTS,
  clearFileSelection,
  fileSelectionTransition,
  projectFieldShellA11y,
  shownErrorsOf,
  showsAsInvalid,
  type MdyFileCandidate,
} from "@modyra/widgets";
import { applyPart, el, setErrors, setText } from "../dom.js";
import { buildFieldShell } from "../field-shell.js";

const DRAGOVER_CLASS = "mdy-file-container--dragover";

function describe(file: MdyFileCandidate): string {
  const kb = Math.max(1, Math.round(file.size / 1024));
  return `${kb} kB`;
}

export function renderFileField(
  container: HTMLElement,
  f: MdyDynamicFileField,
  handle: MdyFieldHandle<unknown>,
  reactivity: MdyReactivity = vanillaReactivity(),
  widgetId: string = f.name,
): () => void {
  const definition = MDY_WIDGET_CONTRACTS.file;
  const selectionOptions = { accept: f.accept, multiple: Boolean(f.multiple) };

  const shell = buildFieldShell(f.label, "file", {}, f.ariaLabel);
  // A file field has no input wrapper in the contract: the drop zone is what holds the control.
  shell.wrapper.remove();

  const dropzone = el("div") as HTMLDivElement;
  applyPart(dropzone, definition.parts.dropzone);
  const control = el("input") as HTMLInputElement;
  control.type = "file";
  // Named so the shell's label can point at it. The native input is visually hidden and the browse
  // button forwards to it, but it is still the control the label is about.
  control.id = widgetId;
  applyPart(control, definition.parts.control);
  control.multiple = Boolean(f.multiple);
  if (f.accept) control.accept = f.accept;
  const content = el("div") as HTMLDivElement;
  applyPart(content, definition.parts.content);
  // The native input is visually hidden by the themes (it is the real control, and its own chrome
  // cannot be styled), so the affordance is a button that forwards the click to it.
  const browse = el("button", "mdy-button") as HTMLButtonElement;
  browse.type = "button";
  setText(browse, "Choose a file");
  const fileList = el("ul") as HTMLUListElement;
  applyPart(fileList, definition.parts.fileList);
  const placeholder = el("span", "mdy-file-placeholder");
  setText(placeholder, "No file selected");
  const clear = el("button", "mdy-file-clear") as HTMLButtonElement;
  clear.type = "button";
  setText(clear, "Clear");
  const info = el("div", "mdy-file-info") as HTMLDivElement;
  info.append(fileList, placeholder, clear);
  content.append(browse, info);
  dropzone.append(control, content);
  shell.root.insertBefore(dropzone, shell.description);

  const selected = reactivity.signal<readonly File[]>([]);

  function commit(candidates: readonly File[]): void {
    const transition = fileSelectionTransition(candidates, selectionOptions);
    if (transition.value === undefined) return;
    const next = transition.value === null ? [] : (Array.isArray(transition.value) ? transition.value : [transition.value]);
    selected.set(next);
    handle.set(next);
    handle.markAsDirty();
    if (transition.touched) handle.markAsTouched();
  }

  browse.addEventListener("click", () => control.click());
  control.addEventListener("change", () => commit(Array.from(control.files ?? [])));
  control.addEventListener("blur", () => handle.markAsTouched());
  clear.addEventListener("click", () => {
    const transition = clearFileSelection<File>();
    selected.set([]);
    control.value = "";
    handle.set(transition.value ?? []);
    handle.markAsDirty();
    handle.markAsTouched();
  });
  // The drop zone is the same policy as the picker, so a dropped file that the accept tokens
  // reject is rejected identically.
  dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropzone.classList.add(DRAGOVER_CLASS);
  });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove(DRAGOVER_CLASS));
  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropzone.classList.remove(DRAGOVER_CLASS);
    const dropped = (event as DragEvent).dataTransfer?.files;
    if (dropped) commit(Array.from(dropped));
  });

  const effectRef = reactivity.effect(() => {
    const files = selected();
    // The state-driven half of the contract. `definition.parts` is static — classes and shape — so
    // on its own it never said the field was invalid, required, disabled or described by its
    // errors. Merged into the static part rather than applied after it, because a second
    // `applyPart` on the same element recomputes classes from the base it captured first.
    const a11y = projectFieldShellA11y(
      { disabled: handle.disabled(), required: handle.required() },
      shownErrorsOf(handle),
      { widgetId: widgetId, controlId: control.id },
    );
    applyPart(shell.label, a11y.label);
    applyPart(shell.description, a11y.description);
    applyPart(shell.errorList, a11y.error);
    applyPart(control, {
      ...definition.parts.control,
      attributes: { ...definition.parts.control.attributes, ...a11y.control.attributes },
    });
    control.disabled = handle.disabled();
    browse.disabled = handle.disabled();
    clear.disabled = handle.disabled() || files.length === 0;
    clear.hidden = files.length === 0;
    placeholder.hidden = files.length > 0;
    fileList.replaceChildren();
    for (const file of files) {
      const item = el("li") as HTMLLIElement;
      applyPart(item, definition.parts.fileItem);
      const name = el("span", "mdy-file-name");
      setText(name, file.name);
      const meta = el("span", "mdy-file-meta");
      setText(meta, describe(file));
      item.append(name, meta);
      fileList.appendChild(item);
    }
    setErrors(shell.errorList, shownErrorsOf(handle).map((error) => error.message));
    shell.syncState({
      touched: handle.touched(), disabled: handle.disabled(),
      hasError: showsAsInvalid({ valid: handle.valid(), disabled: handle.disabled() }), filled: files.length > 0, required: handle.required(),
    });
  });

  container.appendChild(shell.root);
  return () => {
    effectRef.destroy();
    shell.root.remove();
  };
}
