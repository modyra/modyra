/**
 * Select keyboard behavior.
 */

import { listboxNextIndex } from "@modyra/core";

export type MdySelectMoveTarget = "next" | "previous" | "first" | "last";

/**
 * Returns the next active option key for a move intent, or null when the
 * target cannot be moved to (e.g. no enabled options).
 */
export function selectNextActiveKey(
  target: MdySelectMoveTarget,
  activeKey: string | null,
  enabledKeys: readonly string[],
): string | null {
  if (enabledKeys.length === 0) return null;
  const activeIndex = activeKey ? enabledKeys.indexOf(activeKey) : -1;
  const nextIndex = listboxNextIndex(mapTarget(target), activeIndex, enabledKeys.length);
  if (nextIndex === null) return null;
  return enabledKeys[nextIndex] ?? null;
}

function mapTarget(target: MdySelectMoveTarget): string {
  switch (target) {
    case "next":
      return "ArrowDown";
    case "previous":
      return "ArrowUp";
    case "first":
      return "Home";
    case "last":
      return "End";
  }
}

/**
 * Returns the key of the first option whose label starts with the typed
 * character(s), or null if no match is found.
 */
export function selectTypeaheadKey(
  query: string,
  enabledKeys: readonly string[],
  labelForKey: (key: string) => string,
): string | null {
  const q = query.toLowerCase();
  for (const key of enabledKeys) {
    if (labelForKey(key).toLowerCase().startsWith(q)) {
      return key;
    }
  }
  return null;
}
