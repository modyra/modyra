/**
 * Focus handed back to an element that is no longer there.
 *
 * `createCommandRuntime` is what every framework adapter builds its command execution on — Vue,
 * Solid and Svelte each construct one and differ only in `defer` and the id of their announcer. Its
 * design is stated in each of their docblocks in the same words: the execution belongs to
 * `@modyra/widgets`, and what belongs to the adapter is *when the host has rendered*.
 *
 * That is the reason focus and scroll are deferred at all. Running them immediately would move focus
 * to an element the host is about to replace, so they wait for the render.
 *
 * The element does not wait with them. `processWidgetCommands` resolves the target through `lookup`
 * while the commands are being walked, and the deferred closure holds that node. So the runtime
 * waits for a render precisely because the DOM is about to change, and then acts on a node it read
 * before the change.
 *
 * When the host patches its existing element, nothing is wrong. When it replaces it — which is what
 * a keyed re-render, a re-created row or a torn-down and rebuilt overlay all do — `focus()` is
 * called on a detached node, does nothing at all, and focus is left wherever it happened to be.
 * There is no error: a detached `focus()` is a silent no-op, and the only symptom is a keyboard user
 * whose position has quietly moved to the document body.
 *
 * Measured on the published runtime rather than through any adapter, so it does not depend on which
 * framework replaces which node when. Whether a given adapter's scheduler makes this reachable in
 * practice is a separate question and is not claimed here — what is claimed is that the runtime
 * cannot survive it, and that deferring the lookup along with the action would cost nothing.
 */

import { createCommandRuntime } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";
import { installDocument } from "../../harness/dom-env.mjs";

/** Handlers the runtime needs and this battle does not exercise. */
const HANDLERS = Object.freeze({
  setOpen() {},
  setTouched() {},
  commit() {},
  cancel() {},
});

/** What an overlay emits when it closes: shut, then give focus back to what opened it. */
const CLOSING = Object.freeze([
  { type: "close-overlay" },
  { type: "restore-focus", target: { part: "trigger" } },
]);

battle(
  {
    claims: ["A11Y-002"],
    title: "focus goes back to the trigger when nothing moves underneath",
    environments: ["node"],
  },
  async (ctx) => {
    const dom = installDocument();
    try {
      const host = dom.host();
      host.innerHTML = `<button id="trigger">Open</button><input id="elsewhere">`;
      const runtime = createCommandRuntime({
        announcerId: "battle-announcer",
        defer: (run) => queueMicrotask(run),
      });

      // Focus is somewhere else, as it is while an overlay holds it.
      dom.document.getElementById("elsewhere").focus();
      runtime.execute(CLOSING, () => dom.document.getElementById("trigger"), HANDLERS);
      await Promise.resolve();

      ctx.log.note("an overlay closing with a stable trigger", {
        active: dom.document.activeElement?.id ?? null,
      });

      // The control for everything below: with no re-render, restoration works, so a failure in
      // the next battle is the replaced node rather than the runtime never restoring at all.
      expectEqual(dom.document.activeElement?.id ?? null, "trigger", {
        claimIds: ["A11Y-002"],
        what: "focus was not handed back to the trigger even with nothing moving underneath",
      });
    } finally {
      dom.restore();
    }
  },
);

battle(
  {
    claims: ["A11Y-002"],
    title: "focus goes back to the trigger the host rendered, not the one it replaced",
    environments: ["node"],
  },
  async (ctx) => {
    const dom = installDocument();
    try {
      const host = dom.host();
      host.innerHTML = `<button id="trigger">Open</button><input id="elsewhere">`;
      const runtime = createCommandRuntime({
        announcerId: "battle-announcer",
        defer: (run) => queueMicrotask(run),
      });

      dom.document.getElementById("elsewhere").focus();
      runtime.execute(CLOSING, () => dom.document.getElementById("trigger"), HANDLERS);

      // The host renders, and its render replaces the trigger rather than patching it. This is the
      // window the deferral exists for — the runtime is waiting for exactly this to happen.
      const replaced = dom.document.getElementById("trigger");
      const rendered = dom.document.createElement("button");
      rendered.id = "trigger";
      rendered.textContent = "Open";
      replaced.replaceWith(rendered);

      await Promise.resolve();
      ctx.log.note("an overlay closing across a render that replaced the trigger", {
        active: dom.document.activeElement?.id ?? null,
        replacedStillInDocument: dom.document.contains(replaced),
      });

      // The control: the replacement really did leave the document, so the assertion below is
      // about a detached node rather than a re-render that never happened.
      expectClaim(dom.document.contains(replaced) === false && dom.document.contains(rendered), {
        claimIds: ["A11Y-002"],
        what: "the trigger was not actually replaced, so this battle did not create the window it describes",
      });

      // A detached `focus()` is a silent no-op, so there is nothing to catch — the only symptom is
      // a keyboard user who is now on the body.
      expectEqual(dom.document.activeElement?.id ?? null, "trigger", {
        claimIds: ["A11Y-002"],
        what: "focus was never handed back: the runtime focused the node it read before the render",
        detail: JSON.stringify({ active: dom.document.activeElement?.id ?? dom.document.activeElement?.tagName ?? null }),
      });
    } finally {
      dom.restore();
    }
  },
);

battle(
  {
    claims: ["A11Y-002"],
    title: "a target that has gone entirely leaves focus somewhere a user can work from",
    environments: ["node"],
  },
  async (ctx) => {
    const dom = installDocument();
    try {
      const host = dom.host();
      host.innerHTML = `<button id="trigger">Open</button><input id="elsewhere">`;
      const runtime = createCommandRuntime({
        announcerId: "battle-announcer",
        defer: (run) => queueMicrotask(run),
      });

      // The other half of the same window: the trigger is not replaced, it is removed — a row
      // deleted while its picker was open. There is nothing to restore to, and the honest outcome
      // is that the runtime notices rather than focusing a node outside the document.
      dom.document.getElementById("elsewhere").focus();
      runtime.execute(CLOSING, () => dom.document.getElementById("trigger"), HANDLERS);
      const removed = dom.document.getElementById("trigger");
      removed.remove();

      await Promise.resolve();
      ctx.log.note("an overlay closing after its trigger was removed", {
        active: dom.document.activeElement?.id ?? dom.document.activeElement?.tagName ?? null,
        focusedNodeIsDetached: dom.document.activeElement === removed,
      });

      // Whatever the answer is, it must not be a node the document no longer contains — an
      // assistive technology reading the focused element then reads something nobody can see.
      expectClaim(dom.document.activeElement !== removed, {
        claimIds: ["A11Y-002"],
        what: "focus was moved onto an element that is no longer in the document",
      });

      // The control: something in the document holds focus, so the assertion above is not passing
      // because focus went nowhere at all.
      expectClaim(dom.document.contains(dom.document.activeElement), {
        claimIds: ["A11Y-002"],
        what: "the focused element is not in the document",
        detail: String(dom.document.activeElement?.tagName ?? null),
      });
    } finally {
      dom.restore();
    }
  },
);
