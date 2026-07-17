/**
 * Shared select transition fixtures.
 *
 * Canonical state/intent/expect triples used by conformance tests across
 * adapters.
 */

import type { MdySelectIntent } from "../select-types.js";

export interface MdySelectTransitionFixture {
  readonly name: string;
  readonly given: {
    readonly open: boolean;
    readonly selectedKey: string | null;
    readonly activeKey: string | null;
    readonly query: string;
  };
  readonly intent: MdySelectIntent;
  readonly expect: {
    readonly open: boolean;
    readonly selectedKey: string | null;
    readonly activeKey: string | null;
    readonly commandTypes: readonly string[];
  };
}

export const selectTransitionFixtures: readonly MdySelectTransitionFixture[] = [
  {
    name: "ArrowDown opens and activates first enabled option",
    given: { open: false, selectedKey: null, activeKey: null, query: "" },
    intent: { type: "move", target: "next" },
    expect: {
      open: true,
      selectedKey: null,
      activeKey: "rome",
      commandTypes: ["open-overlay", "scroll-into-view"],
    },
  },
  {
    name: "Enter selects active option and closes",
    given: { open: true, selectedKey: null, activeKey: "paris", query: "" },
    intent: { type: "select", optionKey: "paris" },
    expect: {
      open: false,
      selectedKey: "paris",
      activeKey: null,
      commandTypes: ["emit-change", "close-overlay", "restore-focus"],
    },
  },
  {
    name: "Escape closes and restores focus",
    given: { open: true, selectedKey: "rome", activeKey: "paris", query: "" },
    intent: { type: "close", restoreFocus: true },
    expect: {
      open: false,
      selectedKey: "rome",
      activeKey: null,
      commandTypes: ["close-overlay", "restore-focus"],
    },
  },
];
