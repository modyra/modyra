import "@angular/compiler";
import { TestBed } from "@angular/core/testing";
import { Injector, runInInjectionContext } from "@angular/core";
import { mdyForm, field } from "../../public-api";

describe("a typed form's handle", () => {
  it("satisfies the engine's contract, so a widget controller can read it", () => {
    const injector = TestBed.inject(Injector);
    runInInjectionContext(injector, () => {
      const form = mdyForm({ name: field("") });
      const handle = form.f.name as unknown as Record<string, unknown>;
      // The two that were missing. A widget controller calls both; without them the first render
      // threw `handle.readonly is not a function`.
      expect(typeof handle["readonly"]).toBe("function");
      expect(typeof handle["interactivity"]).toBe("function");
      expect((handle["readonly"] as () => boolean)()).toBe(false);
      expect((handle["interactivity"] as () => string)()).toBe("enabled");
    });
  });
});
