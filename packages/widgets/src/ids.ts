/**
 * Deterministic ID policy.
 *
 * Generates stable identifiers for widget parts and items. The policy must
 * be SSR-safe: the same input must produce the same output on server and
 * client.
 */
import { MDY_ID_DELIMITER } from "@modyra/core";

export interface MdyWidgetIdFactory {
  /** ID for a named part of a widget instance. */
  part(widgetId: string, part: string): string;
  /** ID for an item inside a named part (e.g. an option in a listbox). */
  item(widgetId: string, part: string, key: string): string;
}

/**
 * What separates the segments of a generated id.
 *
 * Re-exported from `@modyra/core`, which owns it because the dynamic parser has to reject names
 * containing it and core cannot import this package.
 *
 * It matters because a widget id may not contain it: `part("a", "label")` and a field named
 * `a__label` both land on `a__label`, in different roles. The browser allows two elements to carry
 * the same id, so `getElementById`, `label[for]` and every ARIA IDREF quietly stop being
 * deterministic — a failure invisible until two particular fields share a page.
 *
 * The delimiter is forbidden in names rather than escaped. Escaping would encode `_`, changing the
 * id of every field whose name contains one, and those ids are consumer-visible. Forbidding costs
 * nothing: an id built from a name containing the delimiter was never deterministic in the first
 * place, so nothing correct is being taken away.
 */
export { MDY_ID_DELIMITER } from "@modyra/core";

/**
 * Whether a widget id can safely be a segment of a generated id.
 *
 * Whitespace is refused for the reason the delimiter is: it makes one reference into several.
 * `aria-labelledby` and `aria-describedby` are **space-separated lists** of ids, so a widget id of
 * `"my form"` produces `aria-labelledby="my form__label"`, which an assistive technology reads as
 * two references — `my` and `form__label` — and resolves to nothing anyone rendered. The control
 * then has no accessible name at all, and the markup looks correct while it says nothing.
 *
 * The HTML rule is the same one, written from the other side: an id must not contain ASCII
 * whitespace.
 */
export function isValidWidgetId(widgetId: string): boolean {
  return widgetId.length > 0
    && !widgetId.includes(MDY_ID_DELIMITER)
    && !/[\t\n\f\r ]/.test(widgetId);
}

/**
 * Refuses a widget id that cannot be one, where a widget's part ids are built.
 *
 * {@link isValidWidgetId} is the question a host can ask; this is the answer they get if they do not.
 * A predicate only protects the renderers that remember to call it, and this package is the surface
 * third-party renderers are built on — the one nobody has written yet is who this is for.
 *
 * Not in {@link defaultWidgetIdFactory}: that is a joining primitive a consumer may replace, it is
 * documented as deterministic and reversible, and something constructing ids speculatively is
 * entitled to use it. The per-kind builders are this contract's own front door, and a widget whose
 * ids cannot be referenced is not a widget anyone can render.
 *
 * Loud rather than repaired: an id is consumer-visible, so rewriting one silently would change what
 * a host's tests and stylesheets look for. An id containing whitespace was never a usable id, so
 * nothing correct is refused.
 */
export function assertUsableWidgetId(widgetId: string): void {
  if (isValidWidgetId(widgetId)) return;
  throw new Error(
    `[modyra] "${widgetId}" cannot be a widget id: it must be non-empty, and may contain neither ` +
    `whitespace nor "${MDY_ID_DELIMITER}". Whitespace splits every ARIA reference built from it ` +
    "into several, each resolving to nothing, so the control ends up with no accessible name.",
  );
}

/** Default deterministic ID factory. */
export const defaultWidgetIdFactory: MdyWidgetIdFactory = {
  part(widgetId, part) {
    return `${widgetId}${MDY_ID_DELIMITER}${part}`;
  },
  item(widgetId, part, key) {
    return `${widgetId}${MDY_ID_DELIMITER}${part}${MDY_ID_DELIMITER}${idSafeKey(key)}`;
  },
};

/**
 * A key as a piece of an id.
 *
 * A widget id is a host's word and is refused when it cannot be one; an item key is **data** — an
 * option's value, a row's key — and refusing it would refuse the document that declared it. So it is
 * spelled instead, in the one encoding an id may carry.
 *
 * Whitespace is why: `aria-activedescendant` and its family are space-separated lists of ids, so an
 * option valued `New York` produced `city__option__New York`, which an assistive technology reads as
 * two references and resolves to neither. The person operating the list by keyboard is pointed at
 * nothing, on an option that is on screen.
 *
 * Percent-encoded rather than replaced: `%` goes first so the encoding stays reversible, and the
 * delimiter is encoded because an id carrying it a second time cannot be taken apart again.
 */
function idSafeKey(key: string): string {
  return key
    .replaceAll("%", "%25")
    .replaceAll(MDY_ID_DELIMITER, "%5F%5F")
    .replace(/[\t\n\f\r ]/g, "%20");
}
