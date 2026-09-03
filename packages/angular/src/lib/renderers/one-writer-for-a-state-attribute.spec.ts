import { mountStateFixture } from "./catalog-host.spec";

/**
 * The read-only state still reaches the page with the template no longer writing it.
 *
 * Four kinds stopped binding `aria-readonly` in their own markup, because the contract's projection
 * already writes it on the same element — two authors for one attribute, and the one that lands is
 * decided by nothing either file states. The projection is the author, so the binding went.
 *
 * That leaves a writer nobody watches. The shared state matrix does not demand `aria-readonly` on
 * these four: they are native controls, where the platform's own `readonly` carries the refusal, so
 * a page that dropped the ARIA attribute entirely would still pass there. `segmented` is in the list
 * for the opposite reason — it has no native attribute at all, so the ARIA one is the whole of what
 * a reader gets.
 *
 * Hence this: the attribute is asserted where it is now unguarded, on the element that carries it,
 * in the state that produces it.
 */
const KINDS = ["text", "number", "textarea", "segmented"] as const;

describe("a state attribute with one writer left", () => {
  it("still says read-only, on every kind whose template stopped saying it", () => {
    const missing: string[] = [];
    for (const kind of KINDS) {
      const fixture = mountStateFixture(kind);
      fixture.drive?.("readonly");
      fixture.settle?.();
      const carriers = Array.from((fixture.root as Element).querySelectorAll("[aria-readonly]"));

      // The precondition, not decoration: a fixture that failed to enter the state would report the
      // attribute absent and read exactly like the defect this guards.
      const refused = (fixture.root as Element).querySelectorAll("[readonly], [aria-readonly]").length;
      if (refused === 0) {
        missing.push(`${kind}: the fixture never entered the read-only state, so nothing was measured`);
        continue;
      }
      if (!carriers.some((element) => element.getAttribute("aria-readonly") === "true")) {
        missing.push(`${kind}: no element says aria-readonly="true" — the projection stopped writing what the template no longer writes`);
      }
    }
    expect(missing).toEqual([]);
  });
});
