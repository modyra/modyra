/**
 * A value, and whether it was read at all.
 *
 * The question that costs the most time here is not *what does the page have* but **did the
 * measurement I just took happen**. Every instance found so far failed towards the answer that
 * confirms: a section that passed because there were no ids to collide, a check that returned early
 * and reported as a pass, a sentinel that went quiet the day its value became valid.
 *
 * A bare value cannot carry that question. `undefined` from a probe means "absent" and "the probe
 * is not implemented" and "it threw" and "nobody asked", and a reader shown a blank cell takes the
 * first of the four. So nothing hands out a bare value: a reading either carries one and says where
 * it came from, or carries the reason it does not.
 *
 * ADR 0188. The principle is one step past ADR 0048's — a snapshot describes what it cannot *carry*;
 * this describes what could not be *read*.
 */

/** Why a reading has no value. Four reasons, because the four have four different repairs. */
export type MdyUnreadReason =
  /** The platform does not offer it — a browser API this one does not implement. */
  | "unsupported"
  /** No collector exists for this question yet. The repair is to write one. */
  | "absent-probe"
  /** A collector ran and raised. The repair is in the collector or in what it read. */
  | "threw"
  /** Nothing asked. A section that was skipped, a column not opened. */
  | "not-attempted";

/** A value that was read, and the account of how. */
export interface MdyValueRead<T> {
  readonly read: true;
  readonly value: T;
  /** What was interrogated: a selector, a part name, an API. */
  readonly source: string;
  /** Where in the subject — a part path, a field name. */
  readonly at: string;
  /**
   * How the answer was obtained.
   *
   * `"own-implementation"` where this code computed something a platform could have been asked for,
   * so a reader is never shown a derivation as though the browser had said it.
   */
  readonly method: string;
}

/** A value that was not read, and why not. */
export interface MdyValueUnread {
  readonly read: false;
  readonly reason: MdyUnreadReason;
  readonly at: string;
  readonly detail?: string;
}

export type MdyReading<T> = MdyValueRead<T> | MdyValueUnread;

/** A reading that has a value. */
export function readingOf<T>(
  value: T,
  where: { readonly source: string; readonly at: string; readonly method: string },
): MdyReading<T> {
  return { read: true, value, source: where.source, at: where.at, method: where.method };
}

/** A reading that does not, with the reason a reader can act on. */
export function unread(
  reason: MdyUnreadReason,
  at: string,
  detail?: string,
): MdyValueUnread {
  return detail === undefined ? { read: false, reason, at } : { read: false, reason, at, detail };
}

/**
 * Run a collector and account for however it ends.
 *
 * The three ways a probe fails are collapsed here rather than at each call site: a collector that
 * raises becomes `threw` with its message, one that answers `undefined` becomes `absent-probe`, and
 * anything else is a reading with its provenance. Written once because a call site that has to
 * remember is a call site that will hand back a bare `undefined` on the day it matters.
 */
export function reading<T>(
  where: { readonly source: string; readonly at: string; readonly method: string },
  collect: () => T | undefined,
): MdyReading<T> {
  let value: T | undefined;
  try {
    value = collect();
  } catch (error) {
    return unread("threw", where.at, error instanceof Error ? error.message : String(error));
  }
  if (value === undefined) {
    return unread("absent-probe", where.at, `${where.source} answered nothing`);
  }
  return readingOf(value, where);
}

/**
 * What a reader is shown when there is no value.
 *
 * Exported so every surface says the same thing, and so the phrase can be asserted: a panel that
 * printed an empty string here would be indistinguishable from one that read an empty value, which
 * is the confusion this whole file exists to remove.
 */
export const MDY_NOT_READ = "(not read)" as const;

/** The text for a reading, whether or not it has a value. Never empty for an unread one. */
export function readingText<T>(one: MdyReading<T>, show: (value: T) => string = String): string {
  return one.read ? show(one.value) : `${MDY_NOT_READ} — ${one.reason}`;
}

/**
 * Read an attribute off the element a contract part was rendered as.
 *
 * The first collector, and the shape every other one takes: it is given an element and a part name,
 * it knows nothing about who is asking, and it accounts for each way the question can fail to have
 * an answer. The panel and the conformance bench call this same function — two probes for one
 * question is how two readings of the same thing came to disagree.
 *
 * The four endings are all reachable here, which is why this is the collector worth writing first:
 * no element for the part is `absent-probe`, an element without the attribute is a *read* `null`
 * rather than an absence, and a selector the platform refuses raises and becomes `threw`.
 */
export function readPartAttribute(
  root: { querySelector(selector: string): { getAttribute(name: string): string | null } | null },
  part: { readonly name: string; readonly selector: string },
  attribute: string,
): MdyReading<string | null> {
  const where = { source: part.selector, at: part.name, method: `getAttribute(${attribute})` };
  return reading(where, () => {
    const element = root.querySelector(part.selector);
    // No element is not "the attribute is absent": nobody could look. The distinction is the whole
    // point of this file, and it is made here rather than by the caller reading a null.
    if (element === null) return undefined;
    // A missing attribute *is* an answer, and `null` is what the platform says. Returned as a read
    // value so a reader sees "null" rather than "(not read)" — the element was there and was asked.
    return element.getAttribute(attribute) as string | null;
  }) as MdyReading<string | null>;
}

/**
 * Whether a part is on the page, and — when it is not — whether it was owed.
 *
 * "Missing" is three different findings wearing one word: a part the contract requires and the
 * renderer did not draw, a part excused by a condition that does not hold right now, and a part
 * nobody looked for. A panel that prints "absent" for all three sends its reader to the wrong one
 * twice out of three times.
 *
 * The excuse is evaluated **when this is asked**, not baked in: a part excused by a closed overlay
 * becomes owed again the moment the overlay opens, in the same session, without the caller
 * re-declaring anything. That is what `partIsOwed` already does; this carries its answer alongside
 * the observation so the two cannot be reported apart.
 */
/*
 * Named an observation rather than a presence: `MdyPartPresence` is already the vocabulary of
 * *conditions* a part may be gated on — `"overlayIsOpen"`, `"documentDeclaresIt"`. This is what was
 * seen when one was looked for, which is a different thing, and one name for both would make a
 * reader ask which sense they had in front of them.
 */
export interface MdyPartObservation {
  /** Whether an element for the part was found. */
  readonly present: boolean;
  /** Whether the contract requires it under the conditions that hold right now. */
  readonly owed: boolean;
  /**
   * What to make of it.
   *
   * `drawn` — present and owed. `extra` — present and not owed, which is a renderer's prerogative.
   * `excused` — absent and not owed, and the condition says why. `missing` — absent and owed, which
   * is the only one of the four that is a defect.
   */
  readonly verdict: "drawn" | "extra" | "excused" | "missing";
  /** The condition the contract gates it on, where it has one. */
  readonly presentWhen?: string;
}

/**
 * Read a part's presence against what the contract owes right now.
 *
 * `holds` and `offers` are the caller's, because only the caller knows whether this widget is open
 * or what capabilities its field was given — and a collector that guessed either would be reporting
 * its guess as the contract's answer.
 */
export function readPartPresence(
  root: { querySelector(selector: string): unknown },
  part: {
    readonly name: string;
    readonly selector: string;
    readonly node: {
      readonly part: string;
      readonly optional?: boolean;
      readonly presentWhen?: string;
      readonly requires?: string;
    };
  },
  facts: {
    readonly holds: (condition: string) => boolean;
    readonly offers: (capability: string) => boolean;
    /** How the contract decides. Passed in so this file does not import the structure module. */
    readonly owes: (
      node: MdyPartObservationNode,
      facts: { holds: (condition: string) => boolean; offers: (capability: string) => boolean },
    ) => boolean;
  },
): MdyReading<MdyPartObservation> {
  const where = {
    source: part.selector,
    at: part.name,
    method: "querySelector + partIsOwed",
  };
  return reading(where, () => {
    const present = root.querySelector(part.selector) !== null;
    const owed = facts.owes(part.node as MdyPartObservationNode, facts);
    const verdict = present
      ? (owed ? "drawn" : "extra")
      : (owed ? "missing" : "excused");
    return {
      present,
      owed,
      verdict,
      ...(part.node.presentWhen === undefined ? {} : { presentWhen: part.node.presentWhen }),
    } as MdyPartObservation;
  });
}

/** The shape `partIsOwed` takes, named here so this file does not depend on the structure module. */
export interface MdyPartObservationNode {
  readonly part: string;
  readonly optional?: boolean;
  readonly presentWhen?: string;
  readonly requires?: string;
}
