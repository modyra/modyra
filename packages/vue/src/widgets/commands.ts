/**
 * Running the commands a controller answers with.
 *
 * A controller does not touch the page: it returns what should happen — close the overlay, put the
 * keyboard back on the trigger, announce something — and the renderer performs it. A renderer that
 * dispatches an intent and drops the answer implements half of every interaction, and the half it
 * drops is the one nobody sees in a screenshot: dismissing a panel from the keyboard leaves focus
 * on nothing, and the person is returned to the top of the document on their next Tab.
 *
 * The lookup is derived from the projection rather than written per kind. The contract already
 * publishes an id for every part it names, and a panel this package draws outside the field is
 * reachable by id when a tree walk from the root would miss it.
 */
import type { Ref } from "vue";
import { executeVueCommands } from "./runtime.js";
import { partClasses } from "@modyra/widgets";
import type { MdyElementLookup, MdyPartContract, MdyUiCommand, MdyWidgetCommandHandlers, MdyWidgetKind } from "@modyra/widgets";

/** A view's parts, however a kind's projection spells them. */
export interface MdyPartsView {
  readonly parts: Readonly<Record<string, MdyPartContract | undefined>>;
}

/**
 * A runner for one widget's commands.
 *
 * `handlers` are what only the component can do — a state the controller cannot reach on its own.
 * Everything else the shared runtime performs, including the deferral that keeps focus off a node
 * the host is about to replace.
 */
export function useCommands(
  kind: MdyWidgetKind,
  view: Ref<MdyPartsView>,
  root: Ref<HTMLElement | null>,
  handlers: MdyWidgetCommandHandlers = { setOpen: () => undefined, onTouched: () => undefined, onDirty: () => undefined },
): (commands: readonly MdyUiCommand[]) => void {
  const lookup: MdyElementLookup = (part, key) => {
    const parts = view.value.parts;
    // A keyed part — one option among many — is published under its key, which is the contract's
    // own spelling of the value and not this renderer's.
    const contract = key === undefined ? parts[part] : parts[key] ?? parts[part];
    const id = contract?.id;
    const byId = id === undefined ? null : document.getElementById(id);
    if (byId !== null) return byId;
    // Not every part carries an id — the contract publishes one where something must reference it,
    // and a part nothing points at has none. Its classes are declared for every part, so they are
    // the route that always exists. Searched in the document because this package draws its panels
    // outside the field, and scoped by the kind's own class so a neighbouring widget's part of the
    // same name is not what answers.
    // The command names a part as a string, because a command is data. `partClasses` is typed per
    // kind, and a part this kind does not declare answers with nothing rather than throwing.
    const classes = partClasses(kind, part as Parameters<typeof partClasses>[1]);
    if (classes.length === 0) return undefined;
    const selector = classes.map((className) => `.${className}`).join("");
    return root.value?.querySelector<HTMLElement>(selector)
      ?? document.querySelector<HTMLElement>(selector)
      ?? undefined;
  };
  return (commands) => { executeVueCommands(commands, lookup, handlers); };
}
