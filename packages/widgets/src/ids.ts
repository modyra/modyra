/**
 * Deterministic ID policy.
 *
 * Generates stable identifiers for widget parts and items. The policy must
 * be SSR-safe: the same input must produce the same output on server and
 * client.
 */

export interface MdyWidgetIdFactory {
  /** ID for a named part of a widget instance. */
  part(widgetId: string, part: string): string;
  /** ID for an item inside a named part (e.g. an option in a listbox). */
  item(widgetId: string, part: string, key: string): string;
}

/** Default deterministic ID factory. */
export const defaultWidgetIdFactory: MdyWidgetIdFactory = {
  part(widgetId, part) {
    return `${widgetId}__${part}`;
  },
  item(widgetId, part, key) {
    return `${widgetId}__${part}__${key}`;
  },
};
