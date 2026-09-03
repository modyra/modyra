import { MDY_WIDGET_CONTRACTS, type MdyWidgetKind } from "@modyra/widgets";
import { mountStateFixture } from "./catalog-host.spec";

/**
 * Every id this adapter points at is an id it also draws.
 *
 * A reference is not tried and abandoned: `aria-labelledby` pointing at nothing produces an empty
 * name and the `aria-label` beside it is never consulted, and `aria-describedby` pointing at nothing
 * removes the description a reader was promised. So a dangling reference is not a missing extra — it
 * is a name or a description **replaced by silence**.
 *
 * These were being found one at a time, by applying a contract part and watching what broke: the
 * caption first, then the description. Enumerating them that way costs a batch per element. This
 * counts them all in one run, for every kind the catalogue declares, so the work is known before it
 * is paid for.
 *
 * Two kinds of nothing, kept apart because they need different repairs:
 *
 * - **dangling** — something points at an id, and no element carries it. The reference is live and
 *   lands in the void.
 * - **unreferenced** — the contract names a part id that this adapter draws no element for. Nothing
 *   points at it *yet*, which is why it is quiet; it becomes the first kind the moment a projection
 *   is applied that names it.
 */
const REFERENCING = ["aria-labelledby", "aria-describedby", "aria-controls", "aria-activedescendant"] as const;

/** The parts every field shell owns, named by the contract's own id convention. */
const SHELL_PARTS = ["label", "description", "errors"] as const;

describe("every reference this adapter writes", () => {
  it("points at an element that exists, on every kind", () => {
    const dangling: string[] = [];
    let referencesSeen = 0;

    for (const kind of Object.keys(MDY_WIDGET_CONTRACTS) as MdyWidgetKind[]) {
      const fixture = mountStateFixture(kind);
      fixture.settle?.();
      const root = fixture.root as Element;
      const document = root.ownerDocument;

      for (const element of Array.from(root.querySelectorAll(REFERENCING.map((a) => `[${a}]`).join(",")))) {
        for (const attribute of REFERENCING) {
          const value = element.getAttribute(attribute);
          if (value === null || value.trim() === "") continue;
          for (const id of value.trim().split(/\s+/)) {
            referencesSeen += 1;
            if (document.getElementById(id) === null) {
              dangling.push(`${kind}: ${element.tagName.toLowerCase()}[${attribute}] -> ${id}`);
            }
          }
        }
      }
    }

    // The bench's own precondition: no references seen would satisfy the claim by having looked at
    // nothing, which is the shape this file exists to refuse.
    expect(referencesSeen).toBeGreaterThan(20);
    expect(dangling).toEqual([]);
  });

  it("draws an element for each shell part the contract gives an id, or is recorded as not drawing it", () => {
    // The second kind of nothing. A part the contract names and this adapter does not identify is
    // silent until something points at it — and then it becomes the first kind, in a batch that was
    // not expecting it. Recorded here so the list is known rather than discovered.
    const undrawn: string[] = [];

    for (const kind of Object.keys(MDY_WIDGET_CONTRACTS) as MdyWidgetKind[]) {
      const fixture = mountStateFixture(kind);
      fixture.settle?.();
      const root = fixture.root as Element;
      const field = (root.querySelector("[id]")?.id ?? "").split("__")[0];
      if (!field) {
        undrawn.push(`${kind}: no element carries an id at all`);
        continue;
      }
      for (const part of SHELL_PARTS) {
        if (root.ownerDocument.getElementById(`${field}__${part}`) === null) {
          undrawn.push(`${kind}: ${part}`);
        }
      }
    }

    // The two the catalogue's own anatomy excuses, named rather than tolerated by a count: on these
    // the control names itself, because the caption would sit inside it. Anything else on this list
    // is a reference waiting to dangle the moment a projection names it.
    expect(undrawn).toEqual(["checkbox: label", "toggle: label"]);
  });
});
