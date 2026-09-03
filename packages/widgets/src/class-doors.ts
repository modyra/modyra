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
  /**
   * For a door reached by reading a property path rather than by calling a function.
   *
   * A renderer that holds the catalogue reaches a part's classes through it instead of spelling
   * them, and that is an access, not a call: no argument list names the kind or the part. The path
   * names its two ends, and the wildcard between them is the shape rather than something a reader
   * interprets. The kind comes from whoever is scanning, because they know which widget the file
   * draws; a path read without one is perimeter rather than a guess.
   */
  readonly readPath?: { readonly root: string; readonly leaf: string };
  /** The classes that path yields, for a kind the caller supplies and a part the path names. */
  readonly resolvePath?: (kind: string, part: string) => readonly string[];
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
/** What a door answered, in the one shape every caller reads. */
export interface MdyDoorAnswer {
  /** The classes the call produces. Empty where the door could not be answered. */
  readonly classes: readonly string[];
  /** Why there are none, in the door's own words, where it declares it cannot be answered. */
  readonly unresolvable?: string;
  /** The property path this door is read as, where it is read rather than called. */
  readonly path?: string;
}

/**
 * One door, asked.
 *
 * The manifest exists so a door added in this package is seen by every gate the same day. That holds
 * for the *names*, and it did not hold for the *shapes*: a caller that switched on which resolver a
 * door carries had to learn each new shape, and one that had not yet learnt `resolvePath` called a
 * `resolve` that was not there. The throw emptied a whole page, in another package, for a manifest
 * entry added here — the product of two growing numbers, back one level up from where it was closed.
 *
 * So the shapes are known in one place. A caller asks and reads `classes`; a door this function has
 * not been taught answers with a reason rather than an exception, because a caller that cannot be
 * told about a new shape must at least not be broken by one.
 *
 * `asked` is whatever the door's own shape takes: the positional arguments as an array, the options
 * record for an object door, `[kind, part]` for a path. A door asked with nothing answers with what
 * it can, which for most doors is nothing at all.
 */
export function answerDoor(door: MdyClassDoor, asked?: unknown): MdyDoorAnswer {
  if (door.unresolvable) return { classes: [], unresolvable: door.unresolvable };
  // Asked with nothing is not answered with nothing, and collapsing the two is worse than the throw
  // this function replaced: a door that was never asked reads as a door that puts no class on any
  // element, which is the opposite of what a caller showing this is trying to say. `undefined` means
  // not asked; a caller that wants the door's own defaults asks with the empty shape — `{}` for an
  // options door, `[]` for a positional one.
  if (asked === undefined) {
    return { classes: [], unresolvable: "asked with nothing: this door takes an argument and none was given" };
  }
  try {
    if (door.resolveObject) {
      return { classes: [...door.resolveObject(asked as Record<string, unknown>)] };
    }
    if (door.resolvePath && door.readPath) {
      const [kind, part] = asked as readonly string[];
      if (typeof kind !== "string" || typeof part !== "string") {
        return { classes: [], unresolvable: "read as a path, and asked without a kind and a part" };
      }
      return {
        classes: [...door.resolvePath(kind, part)],
        path: `${door.readPath.root}.${part}.${door.readPath.leaf}`,
      };
    }
    if (door.resolve) return { classes: [...door.resolve(asked as readonly string[])] };
  } catch {
    // A door asked something it cannot answer adds no class and does not take its caller down with
    // it. The gates report this as perimeter; a page shows the row and keeps the rest of the page.
    return { classes: [], unresolvable: "asked something its own resolver refused" };
  }
  return { classes: [], unresolvable: "a door of a shape this reader has not been taught" };
}

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
    name: "contractParts",
    readPath: { root: "parts", leaf: "classes" },
    resolvePath: (kind, part) => {
      if (!(MDY_WIDGET_KINDS as readonly string[]).includes(kind)) return [];
      try {
        return partClasses(kind as MdyWidgetKind, part as never);
      } catch {
        return [];
      }
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
