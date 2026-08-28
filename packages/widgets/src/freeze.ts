/**
 * Freezing a catalogue all the way down, not just its outermost object.
 *
 * `Object.freeze` reaches one level. A catalogue frozen that way is still a page-wide write target
 * one member in: `CATALOGUE.text.parts.label.classes.push("anything")` succeeds, and from then on
 * every renderer reading the contract reads what the page wrote.
 *
 * Two of the fourteen catalogues were shallow this way, and it stayed invisible while each was
 * reachable only through its own export — a consumer indexing one member at a time does not notice
 * that the member is writable. Publishing an index of all fourteen made every one of them reachable
 * from a single value, which is what turned a latent hole into a found one.
 *
 * Applied **at the source** rather than in the index: a catalogue imported directly must be as safe
 * as the same catalogue reached through the list, or the protection is a property of how you asked.
 *
 * A catalogue may reach itself — an index that lists its own entry holds a reference back to the
 * array being frozen. Every walk here therefore carries the set of objects it has already entered,
 * and a value met twice is left to the visit that is already freezing it.
 */
export function deepFreeze<T>(value: T): T {
  return freezeThrough(value, new Set<object>());
}

function freezeThrough<T>(value: T, entered: Set<object>): T {
  if (value === null || typeof value !== "object") return value;
  if (entered.has(value)) return value;
  entered.add(value);
  if (Object.isFrozen(value) && frozenThroughout(value, new Set<object>())) return value;
  for (const member of Object.values(value as Record<string, unknown>)) freezeThrough(member, entered);
  return Object.freeze(value);
}

/** Whether everything reachable from an already-frozen object is frozen too. */
function frozenThroughout(value: object, seen: Set<object>): boolean {
  if (seen.has(value)) return true;
  seen.add(value);
  return Object.values(value as Record<string, unknown>).every(
    (member) => member === null || typeof member !== "object"
      || (Object.isFrozen(member) && frozenThroughout(member, seen)),
  );
}
