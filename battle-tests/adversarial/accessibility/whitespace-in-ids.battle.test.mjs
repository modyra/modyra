/**
 * A label that stops labelling, because the id it points at contains a space.
 *
 * `isValidWidgetId` is the published guard a renderer calls before building a widget's ids, and its
 * docblock states the failure it exists to prevent in those words: two fields resolving to the same
 * id, so that `getElementById`, `label[for]` and every ARIA IDREF "quietly stop being deterministic
 * — a failure invisible until two particular fields share a page".
 *
 * It rejects the empty string and the delimiter. It accepts whitespace, and whitespace is the one
 * character class that breaks those three mechanisms on a *single* field, with no second field
 * needed.
 *
 * HTML says an id must not contain ASCII whitespace, and the two consumers disagree about what to do
 * when it does. `for` is one id, so a value with a space matches nothing at all. `aria-labelledby` is
 * a space-separated *list*, so `"a b__label"` is read as two references — `a` and `b__label` — and
 * both dangle. The label is not announced, the description is not announced, and the DOM is valid
 * enough that nothing reports it.
 *
 * The battle demonstrates the consequence in a document rather than asserting that a space is bad:
 * an input and its label built from an id the guard accepted, and then the browser's own answer to
 * "which control does this label label" and "which elements name this input".
 */

import { defaultWidgetIdFactory, isValidWidgetId, textFieldPartIds } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";
import { installDocument } from "../../harness/dom-env.mjs";

/** Ids a host could plausibly supply: a scoped form, a tenant, a label typed by a person. */
const WHITESPACE_IDS = Object.freeze(["my form", "user 1", "a\tb", "a\nb", " leading", "trailing "]);

battle(
  {
    claims: ["A11Y-001"],
    title: "an id the guard accepts can be used as an id",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: the guard does refuse things, so accepting whitespace is a gap in what it checks
    // rather than a guard that accepts everything.
    for (const refused of ["", "a__b"]) {
      expectEqual(isValidWidgetId(refused), false, {
        claimIds: ["A11Y-001"],
        what: `the guard accepted ${JSON.stringify(refused)}, which it exists to refuse`,
      });
    }

    expectEqual(isValidWidgetId("ordinary-id"), true, {
      claimIds: ["A11Y-001"],
      what: "the guard refused an ordinary id, so it refuses more than it should",
    });

    for (const id of WHITESPACE_IDS) {
      const accepted = isValidWidgetId(id);
      ctx.log.note("an id carrying whitespace", { id, accepted, built: textFieldPartIds(id).labelId });

      expectEqual(accepted, false, {
        claimIds: ["A11Y-001"],
        what: `the guard accepted ${JSON.stringify(id)}, and an id may not contain whitespace`,
        detail: JSON.stringify({ id, labelId: textFieldPartIds(id).labelId }),
      });
    }
  },
);

battle(
  {
    claims: ["A11Y-001"],
    title: "a label built from a spaced id still labels its control",
    environments: ["node"],
  },
  async (ctx) => {
    const dom = installDocument();
    try {
      /** Build the field the way a renderer does, from the ids the contract hands it. */
      const render = (widgetId) => {
        const ids = textFieldPartIds(widgetId);
        const host = dom.document.createElement("div");
        host.innerHTML =
          `<label id="${ids.labelId}" for="${ids.inputId}">Name</label>` +
          `<input id="${ids.inputId}" aria-labelledby="${ids.labelId}" aria-describedby="${ids.descriptionId}">` +
          `<p id="${ids.descriptionId}">As it appears on your card</p>`;
        dom.document.body.append(host);
        return { host, ids };
      };

      // The control: an ordinary id resolves in all three directions, so the failures below are the
      // whitespace and not this battle's markup.
      const ordinary = render("field-name");
      const ordinaryInput = ordinary.host.querySelector("input");
      const ordinaryLabel = ordinary.host.querySelector("label");
      ctx.log.note("an ordinary id, resolved by the document", {
        labelFinds: ordinaryLabel.getAttribute("for") === ordinaryInput.id,
        byId: dom.document.getElementById(ordinary.ids.labelId) !== null,
      });

      expectClaim(
        dom.document.getElementById(ordinary.ids.inputId) === ordinaryInput &&
          dom.document.getElementById(ordinary.ids.labelId) === ordinaryLabel,
        {
          claimIds: ["A11Y-001"],
          what: "an ordinary id did not resolve, so this battle's markup is what is broken",
        },
      );

      // And the same field built from an id a host was allowed to supply.
      const spaced = render("my form");
      const input = spaced.host.querySelectorAll("input")[0];
      const labelledBy = input.getAttribute("aria-labelledby").split(/\s+/).filter(Boolean);
      const resolved = labelledBy.map((reference) => dom.document.getElementById(reference));
      ctx.log.note("a field whose id carries a space", {
        labelledBy,
        resolved: resolved.map((element) => element?.tagName ?? null),
      });

      // `aria-labelledby` is a list. One id with a space in it is two references, and an assistive
      // technology looks for both.
      expectEqual(labelledBy.length, 1, {
        claimIds: ["A11Y-001"],
        what: "one label reference became several, so an assistive technology looks for ids nobody rendered",
        detail: JSON.stringify(labelledBy),
      });

      expectClaim(resolved.every((element) => element !== null), {
        claimIds: ["A11Y-001"],
        what: "a label reference on a rendered field points at no element in the document",
        detail: JSON.stringify({ labelledBy, found: resolved.map((element) => element?.id ?? null) }),
      });

      // And `for`, which is a single id and so matches nothing at all rather than two things.
      const label = spaced.host.querySelector("label");
      expectEqual(dom.document.getElementById(label.getAttribute("for")), input, {
        claimIds: ["A11Y-001"],
        what: "a label's `for` names an id no element in the document has",
        detail: JSON.stringify({ for: label.getAttribute("for"), inputId: input.id }),
      });
    } finally {
      dom.restore();
    }
  },
);

battle(
  {
    claims: ["A11Y-001"],
    title: "the id factory joins what it is given without inventing a second id",
    environments: ["node"],
  },
  async (ctx) => {
    // The factory itself is sound and is not what this is about — pinned so a fix lands on the guard
    // rather than on the joining, which is deterministic and reversible exactly as documented.
    const part = defaultWidgetIdFactory.part("field", "label");
    const item = defaultWidgetIdFactory.item?.("field", "option", "3") ?? null;
    ctx.log.note("what the factory builds", { part, item });

    expectEqual(part, "field__label", {
      claimIds: ["A11Y-001"],
      what: "the id factory no longer joins a widget id to a part with the declared delimiter",
    });

    // Two widgets the guard admits never collide, which is the property the delimiter rule buys.
    const admitted = ["a", "a-b", "form.name", "1"];
    const built = admitted.map((widgetId) => defaultWidgetIdFactory.part(widgetId, "label"));
    expectEqual(new Set(built).size, admitted.length, {
      claimIds: ["A11Y-001"],
      what: "two widget ids the guard admits produced the same part id",
      detail: JSON.stringify(built),
    });

    // And why the delimiter is forbidden rather than escaped: admitting it *would* collide. The
    // pair below is exactly the ambiguity, and both halves are refused before they reach here — so
    // this is the reason for the rule stated as a check, not a defect in the factory.
    expectEqual(
      defaultWidgetIdFactory.part("a__b", "c"),
      defaultWidgetIdFactory.part("a", "b__c"),
      {
        claimIds: ["A11Y-001"],
        what: "the delimiter no longer creates the ambiguity the guard refuses it for",
      },
    );

    expectEqual([isValidWidgetId("a__b"), isValidWidgetId("a")], [false, true], {
      claimIds: ["A11Y-001"],
      what: "the guard does not refuse the half of that ambiguity it is responsible for",
    });
  },
);
