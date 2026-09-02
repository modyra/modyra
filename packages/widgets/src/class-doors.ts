/**
 * The doors a renderer asks for a class name, declared so a checker need not know their spellings.
 *
 * Every source-reading gate faces the same problem: a renderer that stops restating a name the
 * contract holds reads to a grep as one that stopped drawing the part. Each gate answered it by
 * learning the calls one at a time — three of them, three spellings each, and a fourth door cost a
 * fourth edit in every gate. The doors are what change; teaching each gate about each door is the
 * product of two numbers that both grow.
 *
 * So the doors declare themselves, the way a validator declares the rule it enforces rather than
 * appearing in a list somebody must remember to extend. A gate matches one call shape —
 * `name("literal", "literal")` — looks the name up here, and asks the contract for the value. A door
 * added tomorrow is one entry, and every gate sees it the same day.
 *
 * **A door that cannot be resolved from the source says so.** `stateClass` takes a class, not a kind
 * and a part, so a call site tells a reader nothing without evaluating the expression that produced
 * its argument. Declaring that is the point: a gate can print the perimeter it did not cover instead
 * of reporting the classes as absent, which is the failure this file exists to end.
 */
import { partClasses } from "./part-classes.js";
import { presentationClass } from "./part-classes.js";
import { popupPlacementClass, popupAlignmentClass } from "./overlay.js";
import { multiselectChipClasses, type MdyChipAppearance } from "./chip.js";
import { MDY_WIDGET_KINDS, type MdyWidgetKind } from "./catalog.js";

/** What a gate needs to know about one door. */
export interface MdyClassDoor {
  /** The name as it is written at a call site. */
  readonly name: string;
  /**
   * The classes a call produces, given its arguments as literal strings.
   *
   * `undefined` when the arguments do not name anything the contract can answer — the door is
   * declared, and declared unresolvable, so a gate reports a perimeter rather than a silence.
   */
  readonly resolve?: (args: readonly string[]) => readonly string[];
  /**
   * The classes a call produces when its argument is an options object.
   *
   * A reader supplies one record per combination it cannot pin down and unions the answers, so a
   * call that fixes some keys and leaves others to runtime is answered with exactly the classes it
   * can emit. A key absent from the call is absent from the record, which is what makes the
   * signature's own default apply rather than a value the call site never passes.
   */
  readonly resolveObject?: (record: Record<string, unknown>) => readonly string[];
  /**
   * What each key of that object may hold.
   *
   * A key whose value a reader cannot see is expanded over its domain. A key with no domain
   * declared cannot be expanded, and its call site is a perimeter rather than a guess: a door that
   * invents a domain reports classes an element never carries, which is the same defect as
   * reporting absent the ones it does.
   */
  readonly domains?: Readonly<Record<string, readonly unknown[]>>;
  /** Why a door has no resolver, in the words a reader of a gate's output needs. */
  /**
   * For a positional call, what each argument may hold.
   *
   * `null` in a position means the argument has to be a literal for the call to be answered at all;
   * an array is the domain an expression in that position is expanded over. A door that declares
   * none is answered only when every argument is written out, which is the safe reading: the reader
   * never infers a domain, because a domain it invented would claim classes no call site can emit.
   */
  readonly argDomains?: readonly (readonly unknown[] | null)[];
  readonly unresolvable?: string;
}

const forKind = <T>(fn: (kind: MdyWidgetKind, second: string) => T) =>
  (args: readonly string[]): readonly string[] => {
    const [kind, second] = args;
    if (kind === undefined || second === undefined) return [];
    if (!(MDY_WIDGET_KINDS as readonly string[]).includes(kind)) return [];
    try {
      const answer = fn(kind as MdyWidgetKind, second);
      if (answer === undefined || answer === null) return [];
      return Array.isArray(answer) ? answer as readonly string[] : [String(answer)];
    } catch {
      // A part or name the kind does not have names no class, so it adds none. The contract's own
      // refusal is the answer; swallowing it here would only turn a wrong call into a wrong count.
      return [];
    }
  };

/** Every door, and for each the way a gate turns a call site into the classes it puts on an element. */
export const MDY_CLASS_DOORS: readonly MdyClassDoor[] = Object.freeze([
  { name: "partClasses", resolve: forKind((k, p) => partClasses(k, p as never)) },
  { name: "presentationClass", resolve: forKind((k, n) => presentationClass(k, n)) },
  // Narrower than a widget kind: these answer only for a kind that has a popup. A kind without one
  // is refused at runtime and adds no class, which is the same answer as asking for a part a kind
  // does not have — so the cast is safe in the direction that matters and the guard proves it.
  // A popup's position is decided at runtime, so a call site names the kind and leaves the rest to
  // the moment. The class is on the element whichever position wins, and only these values carry
  // one — every other position is the ordinary case and wears nothing. Declaring the two is what
  // lets a reader answer the call without inventing the values it could not see.
  {
    name: "popupPlacementClass",
    resolve: forKind((k, p) => popupPlacementClass(k as never, p as never)),
    argDomains: [null, ["above", "overlay"]],
  },
  {
    name: "popupAlignmentClass",
    resolve: forKind((k, a) => popupAlignmentClass(k as never, a as never)),
    argDomains: [null, ["right"]],
  },
  {
    name: "multiselectChipClasses",
    resolveObject: (record: Record<string, unknown>) => multiselectChipClasses(record as MdyChipAppearance),
    domains: {
      mode: ["single", "multi"],
      role: ["option", "value"],
      selected: [false, true],
      removable: [false, true],
    },
  },
  {
    name: "stateClass",
    unresolvable:
      "takes a class and a state, not a kind and a part: the first argument is a value, so a call "
      + "site names no class until the expression that produced it is evaluated",
  },
  {
    name: "partStateClass",
    unresolvable:
      "a method on a renderer's own base, which reads the kind from the element it is called on: "
      + "the call site carries the part and the state but not the widget",
  },
]);
