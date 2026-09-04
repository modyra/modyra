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
import { MDY_ARIA_DISABLED_PARTS, type MdyPartContract } from "@modyra/widgets";

export type MdyVuePartProps = Record<string, unknown>;

/**
 * What a component reads off a declared part: the classes it must carry, and the role the contract
 * gives it where it gives one.
 *
 * Narrower than the catalogue's own part type on purpose — a component that draws a part needs these
 * two and nothing else — and declared once here because four components needed the same two. Copied
 * per file, the four agreed until the day one of them was widened.
 */
export interface MdyDeclaredPart {
  readonly classes: readonly string[];
  readonly role?: string | null;
}

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
  // A part declared a button is drawn as one. The map held only the elements that draw nothing, and
  // the first kind to declare an operable part inside its subtree got a `<span>` where a control
  // belonged — which the kit named, because a semantic that discriminates is a claim that can fail.
  button: "button", status: "span", image: "span",
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
 *
 * **`content` is what a part shows.** The walk knows the shape a kind declares and nothing about the
 * value a field holds, so a part whose whole job is to display something was drawn as an empty box
 * with the right classes: a slider with no number beside it, a file field whose prompt says nothing,
 * a clear button with no mark on it. The parts that show a value are precisely the ones components
 * delegate here, which is why the defect landed on exactly those three kinds and on no other.
 */
export function drawDeclaredUnder(
  contract: { structure: { nodes: readonly { part: string; parent?: string; optional?: boolean; element?: string }[] };
    parts: Readonly<Record<string, { classes: readonly string[] }>> },
  parent: string,
  render: (tag: string, props: MdyVuePartProps, children: unknown[]) => unknown,
  except: ReadonlySet<string> = new Set(),
  /**
   * The kind, so the walk can honour the rules keyed by `kind.part`.
   *
   * `MDY_ARIA_DISABLED_PARTS` is the one that matters here: it names the few parts that are drawn at
   * all times and must therefore say whether they can act, because they are not natively disabled.
   * A walk that drew them without it renders a button that looks available and refuses.
   */
  kind?: string,
  disabled = false,
  /** What a part shows, asked of the component that holds the value. */
  content?: (part: string) => unknown,
): unknown[] {
  return contract.structure.nodes
    .filter((node) => node.parent === parent && node.optional !== true && !except.has(node.part))
    .map((node) => {
      const shown = content?.(node.part);
      const below = drawDeclaredUnder(contract, node.part, render, except, kind, disabled, content);
      return render(
        TAG_FOR_ELEMENT[String(node.element)] ?? "span",
        {
          class: contract.parts[node.part]?.classes.join(" "),
          ...(kind !== undefined && MDY_ARIA_DISABLED_PARTS.includes(`${kind}.${node.part}`)
            ? { "aria-disabled": String(disabled) }
            : {}),
        },
        // What a part shows, and then what the structure declares beneath it. Both, because a part
        // can be a box that says something *and* holds something: the file field's prompt is text
        // with the button that empties the field inside it. Written as one or the other, supplying
        // the prompt deleted the button — and a probe that read an absent element as empty text
        // called that a success.
        shown === undefined || shown === null ? below : [shown, ...below],
      );
    });
}
