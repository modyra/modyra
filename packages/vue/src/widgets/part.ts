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
