/**
 * A declared part, as React props.
 *
 * The contract answers a part in one vocabulary — an id, a role, ARIA attributes, the classes it
 * must carry — and every renderer translates that once into its own. Written per component instead,
 * the translation is a rule copied as many times as there are widgets, and the copies agree until
 * the day one of them is corrected.
 *
 * **React's names differ from the DOM's**, which is the whole reason this is not a spread: `class`
 * is `className`, and `for` is `htmlFor`. A component that spread the contract's answer directly
 * would set neither, and would do it silently — an element with no classes reads as a theme that
 * has not loaded, not as a renderer that dropped them.
 */
import type { MdyPartContract } from "@modyra/widgets";

export type MdyReactPartProps = Record<string, unknown>;

/**
 * What a component reads off a declared part: the classes it must carry, and the role the contract
 * gives it where it gives one.
 */
export interface MdyDeclaredPart {
  readonly classes: readonly string[];
  readonly role?: string | null;
}

/** The DOM attribute names React spells differently. */
const REACT_NAME: Readonly<Record<string, string>> = Object.freeze({
  class: "className",
  for: "htmlFor",
  readonly: "readOnly",
  tabindex: "tabIndex",
  maxlength: "maxLength",
  minlength: "minLength",
});

export function partProps(part: MdyPartContract | undefined, extra: MdyReactPartProps = {}): MdyReactPartProps {
  const props: MdyReactPartProps = {};
  if (part !== undefined) {
    if (part.id !== undefined) props["id"] = part.id;
    if (part.role !== undefined && part.role !== null) props["role"] = part.role;
    for (const [name, value] of Object.entries(part.attributes ?? {})) {
      // `null` is how the contract says "no attribute here": dropping the key instead would hand a
      // reader `undefined`, which is a different statement about a projection that meant to speak.
      if (value === null || value === undefined) continue;
      props[REACT_NAME[name] ?? name] = value;
    }
    if (part.classes.length > 0) props["className"] = part.classes.join(" ");
  }
  for (const [name, value] of Object.entries(extra)) {
    const key = REACT_NAME[name] ?? name;
    // Classes compose rather than replace: the part's are what the contract requires, and a
    // component adding its own must not silently drop them.
    if (key === "className") {
      // Composed, and only when there is something to compose: an empty string here would put a
      // bare `class=""` on an element whose part declares no classes of its own.
      const merged = [props[key], value].filter((one) => typeof one === "string" && one !== "").join(" ");
      if (merged !== "") props[key] = merged;
      continue;
    }
    props[key] = value;
  }
  return props;
}
