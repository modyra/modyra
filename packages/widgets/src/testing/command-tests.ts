/**
 * Shared command-execution conformance tests for widget runtimes.
 *
 * Each adapter supplies its test harness (`test` + `assert`), its
 * `executeCommands` function, and a `tick` helper that resolves after the
 * adapter has flushed focus/scroll side effects. The factory registers the
 * same assertions for every runtime, ensuring the framework-free command
 * contract behaves identically everywhere without coupling to a specific
 * test runner or Node types.
 */

import type { MdyUiCommand } from "../commands.js";
import type { MdyElementLookup, MdyWidgetCommandHandlers } from "../command-runtime.js";

interface AssertLike {
  equal(actual: unknown, expected: unknown, message?: string): void;
  ok(value: unknown, message?: string): void;
  deepEqual(actual: unknown, expected: unknown, message?: string): void;
}

type TestFn = (name: string, fn: () => void | Promise<void>) => void;

/**
 * Runs a conformance suite against a runtime-specific command executor.
 */
export function runCommandExecutionTests(
  test: TestFn,
  assert: AssertLike,
  executeCommands: (
    commands: readonly MdyUiCommand[],
    lookup: MdyElementLookup,
    handlers: MdyWidgetCommandHandlers,
  ) => void,
  tick: () => Promise<void>,
): void {
  test("command runtime handles overlay and lifecycle commands", async () => {
    const log: Array<string | { open: boolean } | { scroll: unknown }> = [];
    const fakeEl = {
      focus() {
        log.push("focus");
      },
      scrollIntoView(opts: unknown) {
        log.push({ scroll: opts });
      },
    };

    executeCommands(
      [
        { type: "open-overlay", anchor: { part: "trigger" } },
        { type: "emit-change" },
        { type: "mark-touched" },
        { type: "mark-dirty" },
        { type: "focus", target: { part: "listbox", key: "option-1" } },
        { type: "scroll-into-view", target: { part: "listbox", key: "option-1" } },
        { type: "close-overlay" },
      ],
      (part, key) => (part === "listbox" && key === "option-1" ? fakeEl as unknown as HTMLElement : undefined),
      {
        setOpen(open: boolean) {
          log.push({ open });
        },
        onChange() {
          log.push("onChange");
        },
        onTouched() {
          log.push("onTouched");
        },
        onDirty() {
          log.push("onDirty");
        },
      },
    );

    await tick();

    assert.deepEqual(log.filter((x) => typeof x === "object" && "open" in x), [{ open: true }, { open: false }]);
    assert.ok(log.includes("onChange"));
    assert.ok(log.includes("onTouched"));
    assert.ok(log.includes("onDirty"));
    assert.ok(log.includes("focus"));
    assert.ok(log.some((x) => typeof x === "object" && "scroll" in x));
  });
}
