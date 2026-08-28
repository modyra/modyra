/**
 * The questions an adapter actually asks the contract, asked once.
 *
 * Every renderer reached the catalogues the same way and wrote the same three lines to do it:
 * `keyBindingFor(kind, key, open)?.intent === "open"`, `CONTRACTS[kind].capabilities.x === true`,
 * a cast to say a string is a kind. Written out sixteen times across three adapters, and each site is
 * a chance for one of them to spell the question differently — which is how the same declaration came
 * to mean three things.
 *
 * **The kind is always an argument.** A helper that closes over a kind reads well in one renderer and
 * cannot be reused by the next, and the shape of these questions is exactly what a fourth adapter
 * needs on its first day.
 *
 * None of this is new behaviour. It is the body that was already there, put where it can be asked
 * instead of copied.
 */
import { MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS, type MdyWidgetKind } from "./catalog.js";
import { keyBindingFor, MDY_WIDGET_KEYBOARD, type MdyKeyBinding, type MdyKeyOrPress } from "./transitions.js";

/**
 * Whether `value` is a kind this contract knows.
 *
 * A type guard rather than a cast: a renderer handed a string from a document had no way to ask, so
 * it asserted — and an unknown kind then indexed into the catalogue and produced `undefined` several
 * calls later, where the stack no longer says which string was wrong.
 */
export function isWidgetKind(value: unknown): value is MdyWidgetKind {
  return typeof value === "string" && (MDY_WIDGET_KINDS as readonly string[]).includes(value);
}

/**
 * Whether this key means this intent for this kind, in this phase.
 *
 * The commonest question in the adapters, and the one whose spelling drifted: some sites compared
 * against `?.intent`, some checked for a binding at all, and the two differ on a key declared with a
 * different meaning. One question, one answer.
 */
export function keyMeans(
  kind: MdyWidgetKind,
  key: MdyKeyOrPress,
  intent: MdyKeyBinding["intent"],
  open: boolean,
  /** The part the person is on, where a key means one thing there and another at the control. */
  on?: string,
): boolean {
  return keyBindingFor(kind, key, open, on)?.intent === intent;
}

/**
 * The binding a kind declares for an intent, or `null` where it declares none.
 *
 * The question in the other direction: a renderer that wants to *offer* a gesture — a hint beside a
 * control, a shortcut in a menu — needs the key rather than the meaning, and read the table by hand
 * to find it. Reading the table by hand is how a renderer came to name a key the contract had moved.
 *
 * The phase is optional because the question is often asked outside one: absent, the first binding
 * for that intent answers, whichever phase declares it.
 */
export function bindingForIntent(
  kind: MdyWidgetKind,
  intent: MdyKeyBinding["intent"],
  open?: boolean,
): MdyKeyBinding | null {
  const phase = open === undefined ? undefined : open ? "open" : "closed";
  for (const binding of MDY_WIDGET_KEYBOARD[kind]) {
    if (binding.intent !== intent) continue;
    if (phase !== undefined && binding.when !== undefined && binding.when !== phase) continue;
    return binding;
  }
  return null;
}

/**
 * Whether a kind declares a capability, for the capabilities that are a yes or a no.
 *
 * Every renderer read `capabilities` by indexing, which types fine and answers `undefined` for a name
 * that is not there — indistinguishable from a capability declared `false`. This says "declared and
 * true" and nothing else.
 *
 * Not every capability is a yes or a no. `dismissOnOutsidePointer` is a named strategy and `anchoring`
 * is a record of measurements; asked through this door they would answer `false`, which reads as
 * "this kind does not do that" for six kinds that do. A boolean question about a value that is not a
 * boolean has no true answer, so it raises rather than inventing one — the caller wants the value,
 * and the catalogue is where the value is.
 */
export function capabilityOf(kind: MdyWidgetKind, name: string): boolean {
  const capabilities = MDY_WIDGET_CONTRACTS[kind].capabilities as Readonly<Record<string, unknown>>;
  const declared = capabilities[name];
  if (declared !== undefined && typeof declared !== "boolean") {
    throw new TypeError(
      `${kind}.${name} is declared as ${typeof declared}, not a yes or a no — read it from the catalogue`,
    );
  }
  return declared === true;
}
