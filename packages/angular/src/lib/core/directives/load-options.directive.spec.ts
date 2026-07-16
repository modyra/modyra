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

describe("MdyLoadOptionsDirective", () => {
  async function settle(ms: number): Promise<void> {
    await new Promise((r) => setTimeout(r, ms));
  }

  beforeEach(() => {
    fake.searchQuery.set("");
    fake.overrideOptions.set(null);
    fake.loadingOverride.set(null);
  });

  it("loads options for the query with loading state, debounced", async () => {
    const calls: string[] = [];
    const fixture = TestBed.createComponent(LoadOptionsHostComponent);
    fixture.componentInstance.loader = async (q) => {
      calls.push(q);
      return [{ value: q, label: q.toUpperCase() }];
    };
    fixture.detectChanges();

    expect(fake.loadingOverride()).toBe(true); // initial load scheduled
    await settle(30);
    expect(calls).toEqual([""]); // initial empty-query load
    expect(fake.loadingOverride()).toBe(false);

    fake.searchQuery.set("ro");
    fixture.detectChanges();
    expect(fake.loadingOverride()).toBe(true);
    await settle(30);
    expect(calls).toEqual(["", "ro"]);
    expect(fake.overrideOptions()).toEqual([{ value: "ro", label: "RO" }]);
  });

  it("applies last-wins on out-of-order responses", async () => {
    const fixture = TestBed.createComponent(LoadOptionsHostComponent);
    fixture.componentInstance.loader = async (q) => {
      // The earlier query resolves later than the newer one.
      await settle(q === "slow" ? 60 : 0);
      return [{ value: q, label: q }];
    };
    fixture.detectChanges();
    await settle(20);

    fake.searchQuery.set("slow");
    fixture.detectChanges();
    await settle(15); // "slow" fetch in flight
    fake.searchQuery.set("fast");
    fixture.detectChanges();
    await settle(30); // "fast" resolves first

    expect(fake.overrideOptions()).toEqual([{ value: "fast", label: "fast" }]);
    await settle(80); // "slow" resolves late → discarded
    expect(fake.overrideOptions()).toEqual([{ value: "fast", label: "fast" }]);
    expect(fake.loadingOverride()).toBe(false);
  });

  it("falls back to empty options when the loader rejects", async () => {
    const fixture = TestBed.createComponent(LoadOptionsHostComponent);
    fixture.componentInstance.loader = async () => {
      throw new Error("network");
    };
    fixture.detectChanges();
    await settle(30);
    expect(fake.overrideOptions()).toEqual([]);
    expect(fake.loadingOverride()).toBe(false);
  });

  it("clears overrides on destroy", async () => {
    const fixture = TestBed.createComponent(LoadOptionsHostComponent);
    fixture.detectChanges();
    await settle(30);
    fixture.destroy();
    expect(fake.overrideOptions()).toBeNull();
    expect(fake.loadingOverride()).toBeNull();
  });
});
