/**
 * A contract part, as Vue props.
 *
 * Every renderer needs this translation and each writes it once: a part carries an id, classes,
 * a role and attributes, and a framework wants them shaped its own way. Written here rather than
 * inside each component so that a part gains a member in one place — the day the contract grows one,
 * a component that spelled the three fields it happened to need would keep drawing without it.
 *
 * `null` attributes are dropped rather than rendered. The contract uses `null` to say *no attribute*
 * — `aria-readonly` on a field that is not read-only — and Vue renders `null` as an absent attribute
 * already; the filter is here so the intent is stated rather than inherited from a framework's
 * coincidence.
 */
import type { MdyPartContract } from "@modyra/widgets";

export type MdyVuePartProps = Record<string, unknown>;

export function partProps(part: MdyPartContract | undefined, extra: MdyVuePartProps = {}): MdyVuePartProps {
  if (part === undefined) return { ...extra };
  const attributes = Object.fromEntries(
    Object.entries(part.attributes ?? {}).filter(([, value]) => value !== null && value !== undefined),
  );
  return {
    ...(part.id === undefined ? {} : { id: part.id }),
    ...(part.role === undefined ? {} : { role: part.role }),
    ...attributes,
    ...extra,
    // Merged last and joined by hand: a caller passing its own class means "these as well", and
    // letting the spread decide would silently keep one of the two.
    class: [...(part.classes ?? []), ...(typeof extra.class === "string" ? [extra.class] : [])].join(" ") || undefined,
  };
}

/** What a declared element is drawn as, where the contract does not mean a real control. */
const TAG_FOR_ELEMENT: Readonly<Record<string, string>> = Object.freeze({
  group: "span", presentation: "span", container: "div", text: "span",
});

/**
 * The parts a structure declares under one parent, drawn as declared.
 *
 * Required only: an optional part is one a renderer may leave out, and drawing every declared node
 * would put a required marker on a field that has none and an inline error where there is no error.
 * Recursive, because the declaration is a tree — a toggle's thumb sits inside its track, and
 * flattening the two draws a shape the contract does not describe.
 *
 * `except` is for the parts a component places itself: the control goes where its projection and its
 * handlers can reach it, and drawing it twice would give a field two inputs.
 */
export function drawDeclaredUnder(
  contract: { structure: { nodes: readonly { part: string; parent?: string; optional?: boolean; element?: string }[] };
    parts: Readonly<Record<string, { classes: readonly string[] }>> },
  parent: string,
  render: (tag: string, props: MdyVuePartProps, children: unknown[]) => unknown,
  except: ReadonlySet<string> = new Set(),
): unknown[] {
  return contract.structure.nodes
    .filter((node) => node.parent === parent && node.optional !== true && !except.has(node.part))
    .map((node) => render(
      TAG_FOR_ELEMENT[String(node.element)] ?? "span",
      { class: contract.parts[node.part]?.classes.join(" ") },
      drawDeclaredUnder(contract, node.part, render, except),
    ));
}
