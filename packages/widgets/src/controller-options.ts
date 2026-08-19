/**
 * Whether two controller configurations say the same thing.
 *
 * A widget controller is built from a configuration object, and a host that rebuilds the controller
 * whenever that object's *identity* changes rebuilds it on every render — because writing the
 * configuration at the call is what an argument that is an object literal invites. The controller
 * then resubscribes, the subscription publishes, and the render that follows writes another literal.
 *
 * So identity is the wrong question and contents are the right one. The comparison is deliberately
 * shallow, with one step inside a list: an option list written at the call carries fresh option
 * objects every render, and those are the lists this exists for. Deeper than that a configuration
 * does not go, and a comparison that walked an arbitrary value would cost more than the rebuild it
 * saves.
 *
 * Functions compare by identity, which is right: a handler written at the call is a different
 * handler, and treating two of them as one would keep a controller wired to the render that made it.
 */

/** Whether two values are the same for the purpose of rebuilding a controller. */
function sameMember(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => sameEntry(item, b[index]));
  }
  return false;
}

/** One list entry against another: an option is its own members, and nothing below them. */
function sameEntry(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) return false;
  const keys = Object.keys(a as Record<string, unknown>);
  if (keys.length !== Object.keys(b as Record<string, unknown>).length) return false;
  return keys.every((key) =>
    Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
}

/**
 * True when `next` describes the same controller as `held`.
 *
 * `undefined` on either side is a configuration a host has not built yet, and two of those are the
 * same one.
 */
export function sameControllerOptions(held: unknown, next: unknown): boolean {
  if (Object.is(held, next)) return true;
  if (typeof held !== "object" || held === null || typeof next !== "object" || next === null) {
    return false;
  }
  if (Array.isArray(held) !== Array.isArray(next)) return false;
  const keys = Object.keys(held as Record<string, unknown>);
  if (keys.length !== Object.keys(next as Record<string, unknown>).length) return false;
  return keys.every((key) =>
    sameMember((held as Record<string, unknown>)[key], (next as Record<string, unknown>)[key]),
  );
}

/**
 * The configuration's members that can be compared at all.
 *
 * A handler written at the call is a new function every render, so comparing one by identity defeats
 * the comparison entirely — the functions are answered by {@link stableControllerOptions} instead,
 * and what is compared is everything else.
 */
export function comparableControllerOptions(options: unknown): unknown {
  if (typeof options !== "object" || options === null || Array.isArray(options)) return options;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(options as Record<string, unknown>)) {
    if (typeof value !== "function") out[key] = value;
  }
  return out;
}

/**
 * The same configuration with one stable function per handler, each calling the latest one given.
 *
 * A controller keeps the handler it was built with, and a host that rebuilt the controller whenever
 * a handler's identity changed rebuilt it on every render. `latest` is read at call time, so the
 * handler the controller holds is never the one from a render that has passed.
 */
export function stableControllerOptions<T>(options: T, latest: () => T): T {
  if (typeof options !== "object" || options === null || Array.isArray(options)) return options;
  const out: Record<string, unknown> = { ...(options as Record<string, unknown>) };
  for (const [key, value] of Object.entries(options as Record<string, unknown>)) {
    if (typeof value !== "function") continue;
    out[key] = (...args: readonly unknown[]): unknown => {
      const now = (latest() as Record<string, unknown>)[key];
      return typeof now === "function" ? (now as (...given: readonly unknown[]) => unknown)(...args) : undefined;
    };
  }
  return out as T;
}
