/**
 * What a widget is allowed to assume about where it is running.
 *
 * A kind that owns an overlay cannot be rendered whole on a server: the popup's position is measured
 * against a viewport, and there is none. `isFullyServerRenderable` is the published answer, and
 * `staticParts`/`dynamicParts` split each kind's anatomy into the half that survives the server and
 * the half that appears when the widget is alive.
 *
 * The capability probe underneath is the part worth attacking, because the tempting optimisation is
 * the defect: computing it once at module scope. That reads correctly in a browser-only app and
 * silently breaks server rendering and hydration, where the same module is evaluated in a process
 * with no DOM and then asked again after one exists. Nothing about the shape of the code says which
 * it is, so the battle asks the question in both places and checks the answer changes.
 *
 * It also checks the probe degrades one capability at a time rather than as a block. A DOM without
 * `ResizeObserver` or the popover API is not hypothetical — it is jsdom, it is an older Safari, and
 * a widget that reads `dom: true` and assumes the rest is what breaks there.
 *
 * The last battle pins a semantic that looks like an inconsistency and is a decision: a multiselect's
 * option list is a group of toggle buttons, not a listbox, because each chip is independently on or
 * off and all are on screen at once. The part is *named* `listbox`, so a refactor toward "consistency
 * with select" is the plausible mistake — and the naming rule that would force a name onto a real
 * listbox correctly does not fire on a group.
 */

import {
  MDY_WIDGET_CONTRACTS,
  browserRuntimeCapabilities,
  dynamicParts,
  isFullyServerRenderable,
  partsRequiringName,
  ssrRuntimeCapabilities,
  staticParts,
} from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";
import { installDocument } from "../../harness/dom-env.mjs";

/** Kinds that own an overlay, and so cannot be finished without a viewport to measure. */
const OVERLAY_KINDS = Object.freeze(["select", "multiselect", "datepicker", "daterange", "timepicker", "colors"]);

/** Kinds that are one control and some text, and so are finished the moment the markup exists. */
const FLAT_KINDS = Object.freeze(["text", "textarea", "number", "checkbox", "radio", "slider", "segmented", "file"]);

battle(
  {
    claims: ["SSR-001"],
    title: "a kind that needs a viewport says so, and the rest do not",
    environments: ["node"],
  },
  async (ctx) => {
    for (const kind of OVERLAY_KINDS) {
      const dynamic = dynamicParts(kind);
      ctx.log.note("a kind that owns an overlay", { kind, dynamic: dynamic.length });

      expectClaim(isFullyServerRenderable(kind) === false, {
        claimIds: ["SSR-001"],
        what: `${kind} owns an overlay and claims to render whole on a server`,
      });

      // And it names which parts those are, or a server renderer has no way to know what to leave
      // out — "not fully renderable" alone tells it nothing actionable.
      expectClaim(dynamic.length > 0, {
        claimIds: ["SSR-001"],
        what: `${kind} is not fully server-renderable and names no part that has to wait`,
      });
    }

    // The control: the flat kinds are renderable and have nothing waiting, so the assertions above
    // are about overlays rather than about a function that answers the same way for everything.
    for (const kind of FLAT_KINDS) {
      expectEqual([isFullyServerRenderable(kind), dynamicParts(kind).length], [true, 0], {
        claimIds: ["SSR-001"],
        what: `${kind} is one control and some text, and did not render whole on a server`,
      });

      expectClaim(staticParts(kind).length > 0, {
        claimIds: ["SSR-001"],
        what: `${kind} declares no part that survives the server, which leaves nothing to render`,
      });
    }
  },
);

battle(
  {
    claims: ["SSR-001", "REA-001"],
    title: "the capability probe answers about the process it is asked in",
    environments: ["node"],
  },
  async (ctx) => {
    // Before: this process has no DOM, so every capability is absent and the SSR constant says so.
    const beforeDom = browserRuntimeCapabilities();
    ctx.log.note("capabilities with no DOM in the process", { beforeDom });

    expectEqual(beforeDom.dom, false, {
      claimIds: ["SSR-001"],
      what: "a process with no DOM reported that it has one",
      detail: JSON.stringify(beforeDom),
    });

    expectEqual(ssrRuntimeCapabilities.dom, false, {
      claimIds: ["SSR-001"],
      what: "the server capability constant claims a DOM",
    });

    const dom = installDocument();
    try {
      // After: the same call, same module instance. A probe computed once at module scope would
      // still be reporting the answer above, which is the failure this battle exists for.
      const withDom = browserRuntimeCapabilities();
      ctx.log.note("capabilities once a document exists", { withDom });

      expectEqual(withDom.dom, true, {
        claimIds: ["SSR-001"],
        what: "the probe still reports no DOM after one exists, so it was decided once at module scope",
        detail: JSON.stringify(withDom),
      });

      // One capability at a time. This environment has a document and pointer events and has
      // neither ResizeObserver nor the popover API — a widget that reads `dom` and assumes the rest
      // is what breaks in exactly this shape of environment.
      expectClaim(withDom.resizeObserver === false && withDom.popover === false, {
        claimIds: ["SSR-001"],
        what: "the probe reported capabilities this environment does not have, so it answers as a block",
        detail: JSON.stringify(withDom),
      });

      // The SSR constant is a constant: it must not have moved because a DOM turned up.
      expectEqual(ssrRuntimeCapabilities.dom, false, {
        claimIds: ["REA-001"],
        what: "the server capability constant changed when a document appeared",
      });
    } finally {
      dom.restore();
    }

    // And back, so the probe is not one-way — a test process that installs and tears down a DOM
    // must not leave every later question answered wrong.
    expectEqual(browserRuntimeCapabilities().dom, false, {
      claimIds: ["SSR-001"],
      what: "the probe still reports a DOM after the document was torn down",
      detail: JSON.stringify(browserRuntimeCapabilities()),
    });
  },
);

battle(
  {
    claims: ["A11Y-004"],
    title: "a multiselect's options are a group of toggles, not a listbox",
    environments: ["node"],
  },
  async (ctx) => {
    const semanticOf = (kind, part) =>
      MDY_WIDGET_CONTRACTS[kind].structure.nodes.find((node) => node.part === part)?.element ?? null;

    // **The two kinds name the same anatomical thing differently**: a select's option list is the part
    // `listbox`, a multiselect's is `options`. Asking a multiselect for `listbox` gets `null` — which
    // this battle read as "declares no semantics" and reported as a defect, when what it had found was
    // a part that had been renamed out from under it.
    // **Derived, not spelled.** A kind's option list is the part its options sit in, and the catalogue
    // is what knows the name — it was `listbox` for select until ADR 0132 renamed it, and this line
    // held the old spelling for exactly as long as it took the next run.
    const optionListOf = (kind) => ["options", "listbox", "grid", "menu"]
      .find((name) => MDY_WIDGET_CONTRACTS[kind].parts[name] !== undefined);
    const OPTION_LIST = { select: optionListOf("select"), multiselect: optionListOf("multiselect") };
    ctx.log.note("what two option lists declare themselves to be", {
      select: semanticOf("select", OPTION_LIST.select),
      multiselect: semanticOf("multiselect", OPTION_LIST.multiselect),
      multiselectOption: semanticOf("multiselect", "option"),
    });

    // A real listbox, which is the comparison that makes the next assertion mean something.
    expectEqual(semanticOf("select", OPTION_LIST.select), "listbox", {
      claimIds: ["A11Y-004"],
      what: "a select's option list stopped declaring itself a listbox",
    });

    // And the one that is not. Each chip is independently on or off and all are on screen at once,
    // which is a pressed toggle rather than a roving selection — so the part is named `listbox` and
    // is a group. A refactor toward consistency with select is the plausible mistake, and it would
    // announce "N of M selected" over controls that do not work that way.
    expectEqual(semanticOf("multiselect", OPTION_LIST.multiselect), "group", {
      claimIds: ["A11Y-004"],
      what: "a multiselect's option list declares listbox semantics, which its chips do not have",
    });

    // The naming rule follows the semantic and not the part name, which is what makes the decision
    // above hold together: a real listbox is made to carry a name, a group is not.
    expectClaim(partsRequiringName("select").includes(OPTION_LIST.select), {
      claimIds: ["A11Y-004"],
      what: "a select's listbox is not required to carry a name",
      detail: JSON.stringify(partsRequiringName("select")),
    });

    expectEqual(partsRequiringName("multiselect"), [], {
      claimIds: ["A11Y-004"],
      what: "a multiselect part is required to carry a name, which the group semantic does not ask for",
      detail: JSON.stringify(partsRequiringName("multiselect")),
    });
  },
);
