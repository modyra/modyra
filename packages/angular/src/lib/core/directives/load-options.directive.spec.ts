import { Component, signal, WritableSignal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MDY_OPTIONS_CONTROL } from "../tokens";
import { MdyOptionsControl, MdySelectOption } from "../types";
import {
  MdyLoadOptionsDirective,
  MdyOptionsLoader,
} from "./load-options.directive";

interface FakeOptionsControl extends MdyOptionsControl<string> {
  readonly searchQuery: WritableSignal<string>;
}

function makeFakeControl(): FakeOptionsControl {
  return {
    overrideOptions: signal<readonly MdySelectOption<string>[] | null>(null),
    options: signal<readonly MdySelectOption<string>[]>([]),
    loading: signal(false),
    loadingOverride: signal<boolean | null>(null),
    searchQuery: signal(""),
    resetSelection: () => undefined,
  };
}

const fake = makeFakeControl();

@Component({
  standalone: true,
  imports: [MdyLoadOptionsDirective],
  providers: [{ provide: MDY_OPTIONS_CONTROL, useValue: fake }],
  template: `<div [mdyLoadOptions]="loader" [mdyLoadOptionsDebounce]="10"></div>`,
})
class LoadOptionsHostComponent {
  loader: MdyOptionsLoader = async () => [];
}

// ─── Concurrency helpers ─────────────────────────────────────────────────────
// No wall-clock sleeps: response ordering is driven by explicitly-resolved
// deferreds, and every wait is a condition poll over observable state with
// a generous deadline — a failure surfaces as a clear timeout, never as a
// racing assertion.

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Polls a condition, yielding macrotasks so real (debounce) timers can fire. */
async function waitFor(
  condition: () => boolean,
  description: string,
): Promise<void> {
  const deadline = Date.now() + 2000;
  while (!condition()) {
    if (Date.now() > deadline) {
      throw new Error(`timed out waiting for ${description}`);
    }
    await flush();
  }
}

/** Drains pending microtasks (a resolved deferred's .then handlers). */
function flush(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

type Options = ReadonlyArray<MdySelectOption<string>>;

/**
 * Loader whose responses the test resolves by hand: each call is recorded
 * and its promise is stored per query.
 */
class ScriptedLoader {
  readonly calls: string[] = [];
  private readonly pending = new Map<string, Deferred<Options>>();

  readonly loader: MdyOptionsLoader = (query) => {
    this.calls.push(query);
    const d = deferred<Options>();
    this.pending.set(query, d);
    return d.promise;
  };

  resolveWith(query: string, options: Options): void {
    const d = this.pending.get(query);
    if (!d) throw new Error(`no pending fetch for query "${query}"`);
    d.resolve(options);
  }

  rejectWith(query: string, reason: unknown): void {
    const d = this.pending.get(query);
    if (!d) throw new Error(`no pending fetch for query "${query}"`);
    d.reject(reason);
  }
}

describe("MdyLoadOptionsDirective", () => {
  beforeEach(() => {
    fake.searchQuery.set("");
    fake.overrideOptions.set(null);
    fake.loadingOverride.set(null);
  });

  it("loads options for the query with loading state, debounced", async () => {
    const scripted = new ScriptedLoader();
    const fixture = TestBed.createComponent(LoadOptionsHostComponent);
    fixture.componentInstance.loader = scripted.loader;
    fixture.detectChanges();

    expect(fake.loadingOverride()).toBe(true); // initial load scheduled
    await waitFor(() => scripted.calls.includes(""), "initial load");
    scripted.resolveWith("", [{ value: "", label: "" }]);
    await waitFor(
      () => fake.loadingOverride() === false,
      "initial load to settle",
    );

    fake.searchQuery.set("ro");
    fixture.detectChanges();
    expect(fake.loadingOverride()).toBe(true);
    await waitFor(() => scripted.calls.includes("ro"), '"ro" fetch');
    scripted.resolveWith("ro", [{ value: "ro", label: "RO" }]);
    await waitFor(
      () => fake.overrideOptions() !== null,
      '"ro" options applied',
    );
    expect(scripted.calls).toEqual(["", "ro"]);
    expect(fake.overrideOptions()).toEqual([{ value: "ro", label: "RO" }]);
    expect(fake.loadingOverride()).toBe(false);
  });

  it("applies last-wins on out-of-order responses", async () => {
    const scripted = new ScriptedLoader();
    const fixture = TestBed.createComponent(LoadOptionsHostComponent);
    fixture.componentInstance.loader = scripted.loader;
    fixture.detectChanges();
    await waitFor(() => scripted.calls.includes(""), "initial load");
    scripted.resolveWith("", []);
    await waitFor(
      () => fake.loadingOverride() === false,
      "initial load to settle",
    );

    fake.searchQuery.set("slow");
    fixture.detectChanges();
    await waitFor(() => scripted.calls.includes("slow"), '"slow" fetch');

    fake.searchQuery.set("fast");
    fixture.detectChanges();
    await waitFor(() => scripted.calls.includes("fast"), '"fast" fetch');

    // The newer query resolves first → applied.
    scripted.resolveWith("fast", [{ value: "fast", label: "fast" }]);
    await waitFor(
      () => fake.overrideOptions() !== null,
      '"fast" options applied',
    );
    expect(fake.overrideOptions()).toEqual([{ value: "fast", label: "fast" }]);

    // The stale response arrives late → discarded (last-wins), loading
    // state untouched (already settled by the winning run). Flush so the
    // stale .then handler has actually run before asserting.
    scripted.resolveWith("slow", [{ value: "slow", label: "slow" }]);
    await flush();
    expect(fake.overrideOptions()).toEqual([{ value: "fast", label: "fast" }]);
    expect(fake.loadingOverride()).toBe(false);
  });

  it("falls back to empty options when the loader rejects", async () => {
    const scripted = new ScriptedLoader();
    const fixture = TestBed.createComponent(LoadOptionsHostComponent);
    fixture.componentInstance.loader = scripted.loader;
    fixture.detectChanges();
    await waitFor(() => scripted.calls.includes(""), "initial load");

    scripted.rejectWith("", new Error("network"));
    await waitFor(
      () => fake.overrideOptions() !== null,
      "rejection fallback applied",
    );
    expect(fake.overrideOptions()).toEqual([]);
    expect(fake.loadingOverride()).toBe(false);
  });

  it("clears overrides on destroy", async () => {
    const scripted = new ScriptedLoader();
    const fixture = TestBed.createComponent(LoadOptionsHostComponent);
    fixture.componentInstance.loader = scripted.loader;
    fixture.detectChanges();
    await waitFor(() => scripted.calls.includes(""), "initial load");
    scripted.resolveWith("", []);
    await waitFor(
      () => fake.loadingOverride() === false,
      "initial load to settle",
    );

    fixture.destroy();
    expect(fake.overrideOptions()).toBeNull();
    expect(fake.loadingOverride()).toBeNull();
  });
});
