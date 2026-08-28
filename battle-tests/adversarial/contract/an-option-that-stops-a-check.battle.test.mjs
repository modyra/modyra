/**
 * `@modyra/widgets/testing` publishes an option that makes a check stop checking, and leaves no
 * trace that it did.
 *
 * `strictClasses` rejects `mdy-` class names the contract does not define. `adapterPrefix` exempts
 * every name beginning with it. A renderer that passes `adapterPrefix: "mdy-plain-"` may then invent
 * as many `mdy-plain-*` classes as it likes, and the conformance kit reports it conforming.
 *
 * That is not a hypothetical: five classes lived in one renderer for months, exempted here **and**
 * in a coverage allowlist, and both read green. A theme could hold any of them; a rename would break
 * a consumer and pass every gate the project has.
 *
 * The argument is not that a renderer never needs a hook of its own. It is that **an exemption has to
 * be visible in the result**, not in the call. A check that answers "conforming" while it was told to
 * skip a class of names has answered a different question from the one its name asks — and the caller
 * who passed the option is not the one who later reads the green.
 *
 * So this asks the kit for the one property that would make the option safe to keep: **using it
 * shows.** Either the invented class is still reported, or the result says a rule was suspended.
 *
 * jsdom here is the right platform, unusually: the subject is the kit's own decision, not what a
 * browser does with a page.
 */
import { JSDOM } from "jsdom";
import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";
import { inspectWidgetDom } from "@modyra/widgets/testing";

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

const KIND = "text";

/** A field of the kind, built from the contract's own structure rather than from a fixture. */
const build = (document) => {
  const definition = MDY_WIDGET_CONTRACTS[KIND];
  const made = new Map();
  for (const node of definition.structure.nodes) {
    const classes = definition.parts[node.part]?.classes ?? [];
    const element = node.part === "control" ? document.createElement("input") : document.createElement("div");
    for (const one of classes) element.classList.add(one);
    made.set(node.part, element);
    const parent = node.parent ? made.get(node.parent) : null;
    if (parent) parent.append(element); else document.body.append(element);
  }
  return made.get("root") ?? document.body.firstElementChild;
};

battle(
  {
    claims: ["ADP-001"],
    title: "an option that stops a check",
    environments: ["node"],
  },
  async (ctx) => {
    const { window } = new JSDOM("<!doctype html><body></body>");
    const root = build(window.document);
    root.classList.add("mdy-plain-inventata");

    const strict = inspectWidgetDom(root, KIND, { strictClasses: true });
    const exempted = inspectWidgetDom(root, KIND, { strictClasses: true, adapterPrefix: "mdy-plain-" });

    ctx.log.note("the same document, inspected twice", {
      strict: strict.length,
      withPrefix: exempted.length,
      invented: "mdy-plain-inventata",
    });

    // The premise: without the option the invented class is caught. If it is not, this battle is
    // measuring a check that was never looking, and the option is not what is hiding anything.
    expectClaim(strict.some((issue) => JSON.stringify(issue).includes("mdy-plain-inventata")), {
      claimIds: ["ADP-001"],
      what: "`strictClasses` alone did not report a class the contract does not define, so this "
        + "measures nothing about the exemption",
      detail: JSON.stringify(strict).slice(0, 300),
    });

    const stillSeen = exempted.some((issue) => JSON.stringify(issue).includes("mdy-plain-inventata"));
    const saysSuspended = exempted.some((issue) => JSON.stringify(issue).toLowerCase().includes("prefix"));

    expectClaim(stillSeen || saysSuspended, {
      claimIds: ["ADP-001"],
      what: "`adapterPrefix` removed a class from the check and the result says nothing about it: "
        + "the kit reports the renderer conforming, and whoever reads that green cannot tell a rule "
        + "was suspended. An exemption belongs in the result, not only in the call",
      detail: `without the option: ${strict.length} issue(s); with it: ${exempted.length}`,
    });
  },
);
