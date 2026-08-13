/**
 * What a mounted form owes when it is taken down, stated once for every renderer.
 *
 * The transitions below are the whole life of a form: it is mounted, it is reconfigured while
 * running, and it is taken down — possibly to be mounted again beside what is still there. Each
 * renderer drives them its own way; what they must produce is the same, and this is where that is
 * written down.
 *
 * The valuable half is what happens *after* unmount, and it is not observable from a single
 * teardown. A renderer that leaks one node per mount looks clean once and ruins a long-lived page,
 * so the conditions below are meant to be asserted over a loop.
 *
 * ## What can be observed, and what cannot
 *
 * DOM, ids and reactivity are observable from the document and the form handle. **Listeners and
 * timers are not**: no DOM implementation exposes a listener registry, so "no listener left" cannot
 * be asserted directly. What stands in for it is `MDY_LIFECYCLE_ISSUE.reactiveEffectSurvived` — an
 * effect that still runs after disposal is the leak that a stray listener would cause, observed
 * through its consequence instead of its registration.
 */

/**
 * The transitions a form goes through, named so a renderer's coverage can be compared against the
 * list rather than against whatever its own suite happened to exercise.
 */
export const MDY_LIFECYCLE_TRANSITIONS = [
  "mount",
  "update-schema",
  "update-value",
  "update-locale",
  "update-theme",
  "disable",
  "reset",
  "unmount",
  "remount",
] as const;

export type MdyLifecycleTransition = (typeof MDY_LIFECYCLE_TRANSITIONS)[number];

/** Every way a teardown can be incomplete, in the contract's words. */
export const MDY_LIFECYCLE_ISSUE = {
  /** An element the instance mounted is still in the document — including one it portalled out. */
  domSurvived: "DOM_SURVIVED_UNMOUNT",
  /** An id the instance minted still resolves, so a new instance would collide with a ghost. */
  idSurvived: "ID_SURVIVED_UNMOUNT",
  /** A disposed instance still reacts: setting a value after teardown changed the document. */
  reactiveEffectSurvived: "REACTIVE_EFFECT_SURVIVED_UNMOUNT",
  /** Two live instances minted the same id, so one field's relationships point at the other's DOM. */
  idCollidedAcrossInstances: "ID_COLLIDED_ACROSS_INSTANCES",
  /**
   * A disposed instance still ran, and failed.
   *
   * The distinction from {@link reactiveEffectSurvived} is which side refused. A handle that rejects
   * a write after teardown is answering correctly and nothing renders. An *effect* that is still
   * subscribed does run, reads a form that has been destroyed, and raises — leaving nothing in the
   * document to see, which is why a check that only compares the document reads it as clean.
   */
  effectThrewAfterUnmount: "EFFECT_THREW_AFTER_UNMOUNT",
} as const;

export type MdyLifecycleIssueCode = (typeof MDY_LIFECYCLE_ISSUE)[keyof typeof MDY_LIFECYCLE_ISSUE];

export interface MdyLifecycleIssue {
  readonly code: MdyLifecycleIssueCode;
  /** What was found, in the contract's vocabulary rather than the renderer's. */
  readonly detail: string;
}

/** Every id present under a root, which is the set an unmount has to give back. */
export function idsUnder(root: ParentNode): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const element of Array.from(root.querySelectorAll("[id]"))) {
    const id = element.getAttribute("id");
    if (id) ids.add(id);
  }
  return ids;
}

export interface MdyUnmountObservation {
  /** The document the instance was mounted into — checked whole, because an overlay is portalled. */
  readonly document: Document;
  /** The ids the instance held while it was mounted, captured before teardown. */
  readonly idsWhileMounted: ReadonlySet<string>;
  /** The document's element count before the instance mounted, so a shared shell is not blamed. */
  readonly elementsBeforeMount: number;
  /**
   * Runs a value change against the torn-down instance's handles.
   *
   * A renderer that leaves an effect subscribed will re-render into a document it no longer owns;
   * this is how that is caught without a listener registry to inspect.
   */
  readonly pokeAfterDispose?: () => void;
  /**
   * Whatever the reactive runtime reported while the poke ran.
   *
   * A surviving effect announces itself here rather than in the document: it runs, reads a form that
   * is gone, and raises where the runtime routes uncaught effect errors. Supply the collector and an
   * effect that outlived its teardown is named; omit it and only the visible half is judged.
   */
  readonly errorsAfterDispose?: () => readonly string[];
}

/**
 * Judges a teardown. An empty result is a complete one.
 *
 * `elementsBeforeMount` rather than zero, because a host page legitimately has content that is not
 * this instance's to remove.
 */
export function inspectUnmount(observation: MdyUnmountObservation): readonly MdyLifecycleIssue[] {
  const { document, idsWhileMounted, elementsBeforeMount, pokeAfterDispose } = observation;
  const issues: MdyLifecycleIssue[] = [];

  const left = document.body.querySelectorAll("*").length - elementsBeforeMount;
  if (left > 0) {
    issues.push({
      code: MDY_LIFECYCLE_ISSUE.domSurvived,
      detail: `${left} element(s) remain in the document after unmount`,
    });
  }

  const survivors = [...idsWhileMounted].filter((id) => document.getElementById(id) !== null);
  if (survivors.length > 0) {
    issues.push({
      code: MDY_LIFECYCLE_ISSUE.idSurvived,
      detail: `id(s) still resolve after unmount: ${survivors.slice(0, 5).join(", ")}`,
    });
  }

  if (pokeAfterDispose) {
    const before = document.body.innerHTML;
    try {
      pokeAfterDispose();
    } catch {
      // A disposed handle that refuses a write is answering correctly: it is not rendering.
    }
    if (document.body.innerHTML !== before) {
      issues.push({
        code: MDY_LIFECYCLE_ISSUE.reactiveEffectSurvived,
        detail: "a value change after dispose still reached the document",
      });
    }
    const raised = observation.errorsAfterDispose?.() ?? [];
    if (raised.length > 0) {
      issues.push({
        code: MDY_LIFECYCLE_ISSUE.effectThrewAfterUnmount,
        detail: `${raised.length} error(s) raised by an effect that outlived its teardown: ${raised[0]}`,
      });
    }
  }

  return issues;
}

/**
 * Judges two instances that are mounted at the same time.
 *
 * Ids are what tie a control to its label, its errors and its popup. Two instances minting the same
 * id do not fail loudly — the relationship simply resolves to the wrong instance's element, and
 * every assertion about a single instance still passes.
 */
export function inspectCoexistence(
  first: ReadonlySet<string>,
  second: ReadonlySet<string>,
): readonly MdyLifecycleIssue[] {
  const shared = [...first].filter((id) => second.has(id));
  if (shared.length === 0) return [];
  return [{
    code: MDY_LIFECYCLE_ISSUE.idCollidedAcrossInstances,
    detail: `${shared.length} id(s) shared by two live instances: ${shared.slice(0, 5).join(", ")}`,
  }];
}
