/**
 * The state matrix, once, for every adapter.
 *
 * `inspectWidgetState` was split so the judgement is shared and only the *driving* is per-adapter —
 * One adapter sets a property, another pushes a signal, a third sets an attribute, and no helper
 * can do all three honestly. Every adapter runs its own matrix over this one collector: a matrix
 * that exists for a single adapter is how a defect fixed in one and missing in the rest passes for
 * closed.
 *
 * This is the shared half. An adapter supplies a driver; it inherits the traversal, the report and
 * the divergence bookkeeping. Assertions stay with the caller, because the three suites run under
 * two different test runners.
 */
import { MDY_WIDGET_STATES, MDY_WIDGET_STATE_SUPPORT, type MdyWidgetState } from "../widget-states.js";
import type { MdyWidgetKind } from "../catalog.js";
import { inspectUnsupportedStateAria, inspectWidgetState } from "./state-tests.js";
import type { MdyDomPartMap } from "./dom-tests.js";

/** One widget, mounted by an adapter and drivable into a state. */
export interface MdyStateFixture {
  readonly root: Element;
  /** Where each contract part is, as `inspectWidgetDom` takes it. */
  parts(): MdyDomPartMap;
  /** The focusable, operable control, when the adapter can name it. */
  control?(): Element | null;
  /**
   * The value the field currently holds, as the form reports it.
   *
   * The state matrix reads the DOM and does not need this; a canonical observation compares the
   * value alongside the shape, and reading it from the DOM would ask each renderer to agree about
   * how it *displays* a value rather than which one it holds.
   */
  value?(): unknown;
  /**
   * Send a key to the widget, wherever focus currently is.
   *
   * The adapter owns this because only it knows where its overlay puts focus, and a key dispatched
   * at a guessed element tests the guess rather than the widget. Returns false when there is
   * nothing to send it to.
   */
  press?(key: string): boolean;
  /**
   * Put the widget in `state`. Return false when the public API offers no way to reach it — that is
   * a finding in itself and is reported rather than skipped silently.
   */
  drive(state: MdyWidgetState): boolean | Promise<boolean>;
  /** Let the adapter's rendering settle. Asserting before this reads every state as its previous
   *  value, which is indistinguishable from a renderer that ignored the change. */
  settle(): Promise<void> | void;
  dispose(): void;
}

export interface MdyStateMatrixOptions {
  /** Which kinds this adapter renders. */
  readonly kinds: readonly MdyWidgetKind[];
  /** Mount one widget of a kind, ready to drive. */
  mount(kind: MdyWidgetKind): MdyStateFixture | Promise<MdyStateFixture>;
}

export interface MdyStateMatrixRow {
  readonly kind: MdyWidgetKind;
  readonly state: MdyWidgetState;
  readonly codes: readonly string[];
  readonly messages: readonly string[];
}

export interface MdyStateMatrixResult {
  readonly rows: readonly MdyStateMatrixRow[];
  /** `kind × state` pairs the adapter's public API cannot reach. */
  readonly undrivable: readonly string[];
  /** Kinds exposing ARIA for a state they do not declare, as `kind` names. */
  readonly unsupportedAria: readonly string[];
  /** Every divergence, keyed `kind × state`, ready to compare against a ledger. */
  readonly observed: Readonly<Record<string, readonly string[]>>;
  /** How many pairs were actually asserted. */
  readonly asserted: number;
  /** How many the adapter should have covered, drivable or not. */
  readonly expected: number;
  report(label: string): string;
}

/** Run every declared state of every kind this adapter renders. */
export async function collectStateMatrix(
  options: MdyStateMatrixOptions,
): Promise<MdyStateMatrixResult> {
  const rows: MdyStateMatrixRow[] = [];
  const undrivable: string[] = [];
  const unsupportedAria: string[] = [];

  for (const kind of options.kinds) {
    for (const state of MDY_WIDGET_STATE_SUPPORT[kind]) {
      const fixture = await options.mount(kind);
      try {
        const driven = await fixture.drive(state);
        await fixture.settle();
        if (!driven) {
          undrivable.push(`${kind} × ${state}`);
          continue;
        }
        const issues = inspectWidgetState(fixture.root, kind, state, {
          parts: fixture.parts(),
          control: fixture.control?.() ?? null,
        });
        rows.push({
          kind,
          state,
          codes: [...new Set(issues.map((issue) => issue.code))].sort(),
          messages: issues.map((issue) => `${issue.code}: ${issue.message}`),
        });
      } finally {
        fixture.dispose();
      }
    }

    // Separate pass: this one is about the states a widget is *not* in.
    //
    // Driven into each of them, not merely mounted. Inspecting the default state catches a
    // projection that emits the forbidden attribute unconditionally, and cannot catch the shape the
    // defect actually had — `state.readonly ? "true" : null`, absent until a consumer sets a state
    // the kind does not declare. Which is what a consumer does the moment a form has a read-only
    // mode, so the loop that never drives it is the one place the contract went unchecked.
    //
    // A fresh mount per state, because an attribute left behind by an earlier drive answers for the
    // next one and the pass goes green for the wrong reason.
    const undeclared = MDY_WIDGET_STATES.filter(
      (state) => !MDY_WIDGET_STATE_SUPPORT[kind].includes(state),
    );
    for (const state of [null, ...undeclared]) {
      const fixture = await options.mount(kind);
      try {
        // An undeclared state the adapter cannot drive is not a finding: what is being asked is
        // whether the widget announces one, and a state it will not enter announces nothing.
        if (state !== null) await fixture.drive(state);
        await fixture.settle();
        if (inspectUnsupportedStateAria(fixture.root, kind).length > 0) {
          if (!unsupportedAria.includes(kind)) unsupportedAria.push(kind);
        }
      } finally {
        fixture.dispose();
      }
    }
  }

  const observed: Record<string, readonly string[]> = {};
  for (const row of rows) {
    if (row.codes.length > 0) observed[`${row.kind} × ${row.state}`] = row.codes;
  }
  const expected = options.kinds.reduce(
    (total, kind) => total + MDY_WIDGET_STATE_SUPPORT[kind].length,
    0,
  );

  return {
    rows,
    undrivable,
    unsupportedAria,
    observed,
    asserted: rows.length,
    expected,
    report(label: string): string {
      const lines = rows.map((row) =>
        `    ${row.kind.padEnd(12)} ${row.state.padEnd(10)} ${row.codes.length ? "DIVERGES" : "ok"}` +
        (row.messages.length ? `\n${row.messages.map((m) => `               ${m}`).join("\n")}` : ""));
      return (
        `\n  state matrix — ${label}: ${rows.length} kind × state pairs asserted\n` +
        lines.join("\n") +
        (undrivable.length ? `\n    not drivable from the public API: ${undrivable.join(", ")}` : "") +
        (unsupportedAria.length ? `\n    ARIA for an undeclared state: ${unsupportedAria.join(", ")}` : "") +
        "\n"
      );
    },
  };
}

/** Normalise a ledger for comparison against {@link MdyStateMatrixResult.observed}. */
export function normalizeStateLedger(
  ledger: Readonly<Record<string, readonly string[]>>,
): Readonly<Record<string, readonly string[]>> {
  return Object.fromEntries(
    Object.entries(ledger).map(([key, codes]) => [key, [...codes].sort()]),
  );
}
