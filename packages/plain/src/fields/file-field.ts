/**
 * Renders the "file" kind: a native input kept as the real control, a drop zone around it, and the
 * list of what was chosen.
 *
 * Which candidates are acceptable — the accept tokens, `multiple`, the size and count caps — is
 * `fileSelectionTransition` in `@modyra/widgets`; this renderer only turns picks and drops into
 * candidates and draws the outcome.
 */
import { observerFor, type MdyFieldHandle, type MdyReactivity } from "@modyra/core";
import type { MdyDynamicFileField } from "@modyra/core";
import {
  createFileFieldController,
  MDY_WIDGET_CONTRACTS,
  stateClass,
  projectFieldShellA11y,
  shownErrorsOf,
  fieldCanBeInvalid,
  visibleErrorsOf,
  type MdyFileCandidate,
  MDY_I18N_MESSAGES_DEFAULT,
  type MdyI18nMessages,
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
  reactivity?: MdyReactivity,
  widgetId: string = f.name,
  /**
   * The words this control shows. The engine has no opinion about them, so they arrive from the
   * widget contract's tables rather than being written here — three renderers each spelling
   * "open the calendar" is three answers to one question.
   */
  messages: MdyI18nMessages = MDY_I18N_MESSAGES_DEFAULT,
): () => void {
  reactivity = observerFor(handle, reactivity);
  const definition = MDY_WIDGET_CONTRACTS.file;

  const shell = buildFieldShell(f.label, "file", {}, f.ariaLabel, f.name, f.supportingText);
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
  setText(browse, messages.fileSelect);
  const fileList = el("ul") as HTMLUListElement;
  applyPart(fileList, definition.parts.fileList);
  const placeholder = el("span", "mdy-file-placeholder");
  setText(placeholder, messages.fileNoneSelected);
  const rejected = el("div") as HTMLDivElement;
  applyPart(rejected, definition.parts.rejected);
  const clear = el("button") as HTMLButtonElement;
  applyPart(clear, definition.parts.clear);
  clear.type = "button";
  setText(clear, messages.fileClearSelection);
  const info = el("div", "mdy-file-info") as HTMLDivElement;
  info.append(fileList, placeholder, rejected);
  // The clear stands with the control that picks, not under the list: below it, its place is the
  // number of files chosen and it moves every time one arrives or leaves. ADR 0173.
  content.append(browse, clear, info);
  dropzone.append(control, content);
  shell.root.insertBefore(dropzone, shell.description);

  /**
   * What the field holds and what it turned away, from the contract rather than from here.
   *
   * The rules the controller applies were already this renderer's — `fileSelectionTransition`, the
   * guard on `interactivity`, the separate list of refusals — written out beside it. What it adds is
   * that the same three renderers now get the same answers, including the ones nobody thought to
   * repeat: a refusal is not part of the value, and a guard on a button is not a lock, because a file
   * still arrives by being dropped, by a script, or through an assistive technology.
   */
  const controller = createFileFieldController<File>({
    widgetId,
    handle: handle as unknown as MdyFieldHandle<readonly File[]>,
    ...(f.accept === undefined ? {} : { accept: f.accept }),
    multiple: Boolean(f.multiple),
  }, reactivity);

  browse.addEventListener("click", () => control.click());
  control.addEventListener("change", () =>
    controller.dispatch({ type: "select", files: Array.from(control.files ?? []) }));
  control.addEventListener("blur", () => controller.dispatch({ type: "blur" }));
  clear.addEventListener("click", () => {
    // A second lock: the controller refuses a clear on a field out of play, so this is not what
    // holds — it is here because the attribute makes a promise, and a promise kept two layers down
    // stops being kept the day that layer changes its mind. ADR 0171.
    if (clear.getAttribute("aria-disabled") === "true") return;
    controller.dispatch({ type: "clear" });
    // The element's own text, which no model owns: a file input keeps the last pick's name until it
    // is told otherwise, and a cleared field showing one is a field claiming a value it does not have.
    control.value = "";
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
    if (dropped) controller.dispatch({ type: "select", files: Array.from(dropped) });
  });

  const effectRef = reactivity.effect(() => {
    const { files, rejected: refused } = controller.state();
    // The state-driven half of the contract. `definition.parts` is static — classes and shape — so
    // on its own it never said the field was invalid, required, disabled or described by its
    // errors. Merged into the static part rather than applied after it, because a second
    // `applyPart` on the same element recomputes classes from the base it captured first.
    const a11y = projectFieldShellA11y(
      { disabled: handle.disabled(), required: handle.required() },
      shownErrorsOf(handle),
      {
        widgetId: widgetId,
        controlId: control.id,
        // What is *shown*, not what is wrong. Without it the projection falls back to "there is an
        // error at all", and a required field nobody has reached announces itself as failing while
        // the list beside it — asked the same question with the person's touch in it — renders
        // nothing. One question, and the eye and the ear were given different answers.
        errorsVisible: visibleErrorsOf(handle, "file").length > 0,
        // The container is pointed at while it is on the page, not only while it holds a message.
        errorsReserved: visibleErrorsOf(handle, "file").length > 0 || fieldCanBeInvalid({
          required: handle.required?.() ?? false,
          constraints: handle.constraints?.() ?? null,
          disabled: handle.disabled?.() ?? false,
        }),
      },
    );
    applyPart(shell.label, a11y.label);
    applyPart(shell.description, a11y.description);
    applyPart(shell.errorList, a11y.error);
    applyPart(control, {
      ...definition.parts.control,
      attributes: { ...definition.parts.control.attributes, ...a11y.control.attributes },
    });
    // A read-only file field has no word of its own: `MDY_WIDGET_STATE_SUPPORT` declares no
    // read-only state for this kind, because the picker is the browser's and the element's role has
    // no `aria-readonly` to carry. What is true and expressible is that the affordance is not
    // operable — the field itself stays in play, submitted and validated.
    const cannotPick = handle.disabled() || handle.readonly();
    control.disabled = cannotPick;
    browse.disabled = cannotPick;
    /**
     * Always there, and dimmed where it cannot act.
     *
     * Hidden while there was nothing to clear, it came and went with the value — so the number of tab
     * stops changed as somebody filled the field in, and whoever had never used it learned it could
     * be emptied only afterwards. `aria-disabled` rather than the property: the native one takes the
     * button out of the tab order and takes focus with it at the moment the state changes, which is
     * the moment somebody has just pressed it. ADR 0171.
     */
    clear.setAttribute("aria-disabled", String(cannotPick || files.length === 0));
    clear.classList.toggle(stateClass(definition.parts.clear.classes[0]!, "disabled"), cannotPick || files.length === 0);
    placeholder.hidden = files.length > 0;
    setText(rejected, refused.length === 0 ? "" : messages.fileRejected(refused.map((file) => file.name)));
    rejected.hidden = refused.length === 0;
    // Out of the flow while it holds nothing, not merely empty. In a column with a gap an empty
    // child is still a child: zero pixels tall and charged a full gap anyway — 8px under a field
    // whose list nobody has filled. The container beside it has been `hidden` all along for the
    // same reason. This list is kept for no reference and appears inside the act that fills it, so
    // both of ADR 0180's tests fail and it is not held.
    fileList.hidden = files.length === 0;
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
    setErrors(shell.errorList, visibleErrorsOf(handle, "file").map((error) => error.message));
    shell.syncState({
      touched: handle.touched(), disabled: handle.disabled(), readonly: handle.readonly(),
      hasError: visibleErrorsOf(handle, "file").length > 0, filled: files.length > 0, required: handle.required(), constraints: handle.constraints?.() ?? null,
    });
  });

  container.appendChild(shell.root);
  return () => {
    effectRef.destroy();
    shell.root.remove();
  };
}
