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

/** Default deterministic ID factory. */
export const defaultWidgetIdFactory: MdyWidgetIdFactory = {
  part(widgetId, part) {
    return `${widgetId}${MDY_ID_DELIMITER}${part}`;
  },
  item(widgetId, part, key) {
    return `${widgetId}${MDY_ID_DELIMITER}${part}${MDY_ID_DELIMITER}${key}`;
  },
};
