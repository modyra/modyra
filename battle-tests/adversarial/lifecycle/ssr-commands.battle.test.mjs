/**
 * A widget told to do something to a page that is not there.
 *
 * A controller emits intents — focus this, scroll to that, announce this — without knowing where it
 * is running. `processWidgetCommands` is where the environment gets a say, and `runtime.ts` states
 * why: "on a server it would be told to focus something that does not exist".
 *
 * So there are two halves. The report has to be honest — with no DOM the probe must answer exactly
 * what the SSR constant says, not assert a DOM it did not find — and the processor has to act on it.
 *
 * Both hold. What is measured and deliberately not asserted is how much of the report anything
 * reads: of the five capabilities declared, `dom` is the only one with a consumer anywhere in the
 * workspace. That is `docs/contract-gaps.md`'s finding C3 and an open decision, so this records the
 * count rather than pinning an answer to a question the project has not taken yet.
 */

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";
import { installDocument } from "../../harness/dom-env.mjs";

const widgets = await import("@modyra/widgets");
const { browserRuntimeCapabilities, processWidgetCommands, ssrRuntimeCapabilities } = widgets;

/** Every command a widget can emit that needs something on a page to act on. */
const COMMANDS = Object.freeze([
  { type: "focus", target: { part: "trigger" } },
  { type: "restore-focus", target: { part: "trigger" } },
  { type: "scroll-into-view", target: { part: "trigger" } },
  { type: "announce", message: "the field is invalid" },
]);

/**
 * Run the commands and report what the host was asked to do.
 *
 * `lookup` answers with an element for every part on purpose: a processor that skipped the commands
 * only because nothing could be found would look identical to one that read the capabilities, and
 * the second is the claim.
 */
function asked(capabilities) {
  const done = [];
  processWidgetCommands(COMMANDS, {
    lookup: () => ({ tagName: "INPUT" }),
    handlers: {},
    scheduleFocus: () => done.push("focus"),
    scheduleScroll: () => done.push("scroll"),
    announce: (message) => done.push(`announce:${message}`),
    capabilities,
  });
  return done;
}

battle(
  {
    claims: ["SSR-001"],
    title: "a page that is not there is not told to focus anything",
    environments: ["node"],
  },
  async (ctx) => {
    // The report first. A probe that asserted a DOM rather than looking for one would make every
    // guard below correct and useless.
    ctx.log.note("capabilities probed with no document installed", browserRuntimeCapabilities());

    expectEqual(browserRuntimeCapabilities(), { ...ssrRuntimeCapabilities }, {
      claimIds: ["SSR-001"],
      what: "the probe reported a capability it could not have found with no DOM",
    });

    // And with one, so the comparison above is a finding about the environment rather than a
    // function that always answers the same way.
    const env = installDocument();
    try {
      const inPage = browserRuntimeCapabilities();
      ctx.log.note("capabilities probed inside a document", inPage);

      expectClaim(inPage.dom === true && inPage.hydrated === true, {
        claimIds: ["SSR-001"],
        what: "the probe did not find the document it was given",
        detail: JSON.stringify(inPage),
      });

      expectClaim(browserRuntimeCapabilities({ hydrated: false }).hydrated === false, {
        claimIds: ["SSR-001"],
        what: "a renderer that says it is still hydrating is not believed",
      });
    } finally {
      env.restore();
    }

    // The control: with a DOM the commands are carried out, so the assertion after it is about the
    // capabilities being read rather than about a processor that does nothing.
    const inBrowser = asked({ dom: true, hydrated: true, popover: false, resizeObserver: false, pointerEvents: true });
    expectEqual(inBrowser, ["focus", "focus", "scroll", "announce:the field is invalid"], {
      claimIds: ["SSR-001"],
      what: "a browser was not asked to carry out the commands a widget emitted",
    });

    // The claim. The lookup answers for every part, so nothing is skipped for want of an element.
    expectEqual(asked(ssrRuntimeCapabilities), [], {
      claimIds: ["SSR-001"],
      what: "a server was asked to focus, scroll or announce",
    });

    // The documented default, pinned so a change to it is a diff rather than a surprise: a renderer
    // that says nothing gets a DOM assumed, which is right for the common case and is exactly what
    // an SSR renderer must not do.
    expectEqual(asked(undefined), inBrowser, {
      claimIds: ["SSR-001"],
      what: "omitting the capabilities stopped behaving like a browser",
    });
  },
);
