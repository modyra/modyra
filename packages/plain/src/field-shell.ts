/**
 * Every field kind shares the same outer shell — label, control, optional
 * description, error list. Renderers build the control themselves and
 * insert it between label and description.
 */
import { el, setText } from "./dom.js";

export interface FieldShell {
  readonly root: HTMLDivElement;
  readonly label: HTMLLabelElement;
  readonly description: HTMLParagraphElement;
  readonly errorList: HTMLUListElement;
}

export function buildFieldShell(labelText: string | undefined): FieldShell {
  const root = el("div") as HTMLDivElement;
  const label = el("label") as HTMLLabelElement;
  if (labelText) setText(label, labelText);
  const description = el("p") as HTMLParagraphElement;
  const errorList = el("ul") as HTMLUListElement;
  root.append(label, description, errorList);
  return { root, label, description, errorList };
}

/** Inserts the control element between the label and the description, where every renderer expects it. */
export function insertControl(shell: FieldShell, control: HTMLElement): void {
  shell.root.insertBefore(control, shell.description);
}
