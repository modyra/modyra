/**
 * An id that cannot be an id, refused where it is built.
 *
 * `isValidWidgetId` is the published guard a renderer calls before building a widget's ids, and its
 * docblock names the failure it exists to prevent: ids that collide, so `getElementById`,
 * `label[for]` and every ARIA IDREF "quietly stop being deterministic".
 *
 * Whitespace is the same failure reached without a second field. HTML says an id must not contain
 * ASCII whitespace, and the two consumers of one behave differently when it does. `for` compares a
 * single id as one string, so the label still finds its control — measured, not assumed.
 * `aria-labelledby` and `aria-describedby` are space-separated *lists*, so `"my form__label"` is
 * read as two references — `my` and `form__label` — and both dangle.
 *
 * So the association survives and the accessible name does not, which is the shape that passes a
 * glance: a control with a visible label beside it and nothing announced.
 *
 * The first battle asserts the plain DOM facts behind that, using no Modyra call at all: it is the
 * reason the rule exists and it stays true whatever the guard decides, so if the rule is ever
 * relaxed this is the cost of relaxing it, stated independently. The others assert the rule itself
 * and the property the delimiter buys.
 *
 * Whether the refusal also belongs at the point the ids are *built* — rather than in a predicate a
 * renderer may forget to call — is a contract question and not pinned here.
 */

import { defaultWidgetIdFactory, isValidWidgetId } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";
import { installDocument } from "../../harness/dom-env.mjs";

/** Ids a host could plausibly supply: a scoped form, a tenant, a label typed by a person. */
const WHITESPACE_IDS = Object.freeze(["my form", "user 1", "a\tb", "a\nb", " leading", "trailing "]);

battle(
  {
    claims: ["A11Y-001"],
    title: "a space in an id loses the name and keeps the association",
    environments: ["node"],
  },
  async (ctx) => {
    const dom = installDocument();
    try {
      // No Modyra call in this battle. It is the platform behaviour the rule is derived from, and
      // it stays true however the guard is written — so if the rule is ever relaxed, this is the
      // cost of relaxing it, stated independently.
      const host = dom.document.createElement("div");
      host.innerHTML =
        `<label id="my form__label" for="my form__input">Name</label>` +
        `<input id="my form__input" aria-labelledby="my form__label">`;
      dom.document.body.append(host);

      const input = host.querySelector("input");
      const label = host.querySelector("label");
      const references = input.getAttribute("aria-labelledby").split(/\s+/).filter(Boolean);
      const resolved = references.map((reference) => dom.document.getElementById(reference));
      ctx.log.note("what a document makes of an id with a space in it", {
        references,
        resolved: resolved.map((element) => element?.tagName ?? null),
        forFinds: dom.document.getElementById(label.getAttribute("for"))?.tagName ?? null,
      });

      // One reference became two, and neither is anything.
      expectEqual(references.length, 2, {
        claimIds: ["A11Y-001"],
        what: "a space in an id no longer splits an ARIA reference, so the rule below protects nothing",
        detail: JSON.stringify(references),
      });

      expectEqual(resolved, [null, null], {
        claimIds: ["A11Y-001"],
        what: "the split references resolved to elements, so the failure this rule prevents is not this one",
        detail: JSON.stringify(references),
      });

      // `for` is a single id compared as one string, so it does resolve — which is what makes this
      // worth stating rather than assuming. The association survives; the *name* does not, and a
      // control with a visible label and no accessible name is the shape that passes a glance.
      expectClaim(dom.document.getElementById(label.getAttribute("for")) === input, {
        claimIds: ["A11Y-001"],
        what: "a `for` naming an id with a space stopped resolving, so the failure is wider than the name",
        detail: JSON.stringify({ for: label.getAttribute("for") }),
      });

      // The control: the same markup with an ordinary id resolves in both directions, so the two
      // nulls above are the whitespace rather than this battle's markup.
      const ordinary = dom.document.createElement("div");
      ordinary.innerHTML =
        `<label id="field__label" for="field__input">Name</label>` +
        `<input id="field__input" aria-labelledby="field__label">`;
      dom.document.body.append(ordinary);

      expectClaim(
        dom.document.getElementById("field__label") !== null &&
          dom.document.getElementById("field__input") !== null,
        {
          claimIds: ["A11Y-001"],
          what: "an ordinary id did not resolve, so this battle's markup is what is broken",
        },
      );
    } finally {
      dom.restore();
    }
  },
);

battle(
  {
    claims: ["A11Y-001"],
    title: "the guard refuses every id that cannot be one",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: the guard admits ordinary ids, so refusing below is a rule and not a guard that
    // refuses everything.
    for (const admitted of ["ordinary-id", "form.name", "1", "a-b"]) {
      expectEqual(isValidWidgetId(admitted), true, {
        claimIds: ["A11Y-001"],
        what: `the guard refused ${JSON.stringify(admitted)}, which is a usable id`,
      });
    }

    // Empty and the delimiter, which it has always refused.
    for (const refused of ["", "a__b"]) {
      expectEqual(isValidWidgetId(refused), false, {
        claimIds: ["A11Y-001"],
        what: `the guard accepted ${JSON.stringify(refused)}, which it exists to refuse`,
      });
    }

    // And whitespace, which breaks the same three mechanisms on a single field.
    for (const id of WHITESPACE_IDS) {
      const accepted = isValidWidgetId(id);
      ctx.log.note("an id carrying whitespace", { id, accepted });

      expectEqual(accepted, false, {
        claimIds: ["A11Y-001"],
        what: `the guard accepted ${JSON.stringify(id)}, and an id may not contain whitespace`,
      });
    }
  },
);

battle(
  {
    claims: ["A11Y-001"],
    title: "two ids the guard admits never produce the same part id",
    environments: ["node"],
  },
  async (ctx) => {
    // The property the delimiter rule buys, pinned so a fix to the guard lands on what it admits
    // rather than on how the joining works.
    const admitted = ["a", "a-b", "form.name", "1"];
    const built = admitted.map((widgetId) => defaultWidgetIdFactory.part(widgetId, "label"));
    ctx.log.note("part ids from four ids the guard admits", { built });

    expectEqual(new Set(built).size, admitted.length, {
      claimIds: ["A11Y-001"],
      what: "two widget ids the guard admits produced the same part id",
      detail: JSON.stringify(built),
    });

    expectEqual(defaultWidgetIdFactory.part("field", "label"), "field__label", {
      claimIds: ["A11Y-001"],
      what: "the id factory no longer joins a widget id to a part with the declared delimiter",
    });

    // And why the delimiter is forbidden rather than escaped: admitting it would make one id out of
    // two different pairs. Both halves are refused before they reach the factory, so this is the
    // reason for the rule stated as a check rather than a defect in the joining.
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
