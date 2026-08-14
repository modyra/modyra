/**
 * What a renderer owes when it is taken down, asserted over a loop.
 *
 * `LIF-001` and `LIF-002` have only ever been attacked against the engine. The engine is not what
 * leaks: a form that keeps no DOM cannot leave any behind, and every teardown promise in the
 * contract — no element survives, no id still resolves, a disposed instance no longer reacts — is
 * about a renderer.
 *
 * `@modyra/widgets/testing` says so itself: "a renderer that leaks one node per mount looks clean
 * once and ruins a long-lived page, so the conditions below are meant to be asserted over a loop."
 * Nothing in this suite ran that loop. This does, against `@modyra/lit` through its published entry
 * point, in a real document.
 *
 * The id half is `A11Y-001`'s other direction. That claim is attacked in the browser tier as a
 * reference that dangles after a row leaves; here it is two live instances over the same field
 * names, where a collision means one field's relationships resolve to the other's DOM — the same
 * defect arriving from the opposite side.
 */

import { field } from "@modyra/core";
import { idsUnder, inspectCoexistence, inspectUnmount } from "@modyra/widgets/testing";

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";
import { installDocument } from "../../harness/dom-env.mjs";

/**
 * One document for the file, and the renderer loaded into it.
 *
 * Two constraints meet here, and each broke this file once. A custom-element renderer reads
 * constructors off the global scope while its module is evaluated, so it has to be imported *after*
 * a document exists — a static import registers the elements against globals that are not there,
 * and the tags then stay unupgraded and render nothing, which reads as a renderer that leaks
 * nothing at all. And the module is cached, so its elements stay registered in the first document's
 * registry: a second document would upgrade nothing, the same silent way.
 *
 * Hence one document, installed once, shared by every battle in the file. Each battle measures the
 * element count it starts from and removes the hosts it added, so they do not read each other's
 * leftovers. The controls below exist because both failures look exactly like a clean renderer.
 */
const env = installDocument();
const lit = await import("@modyra/lit");
lit.defineMdyElements();

/** One frame of the renderer's own settle beat, which is what an element upgrade waits for. */
const painted = () => new Promise((resolve) => setTimeout(resolve, 20));

/**
 * Mount one field into its own host and hand back what a teardown check needs.
 *
 * The element is created and fed the handle the way a template would: the renderer is reached only
 * through its published entry, and nothing here reads its internals.
 */
async function mountField(name) {
  const form = lit.createLitForm({ [name]: field("") });
  const host = env.host();
  const element = env.document.createElement("mdy-text-field");
  element.setAttribute("name", name);
  element.field = form.f[name];
  host.append(element);
  await painted();
  return {
    form,
    host,
    ids: idsUnder(host),
    async dispose() {
      host.remove();
      form.destroy?.();
      await painted();
    },
  };
}

battle(
  {
    claims: ["LIF-001", "LIF-002"],
    title: "a renderer mounted and torn down twenty times leaves nothing behind",
    environments: ["node"],
  },
  async (ctx) => {
    try {
      const before = env.document.body.querySelectorAll("*").length;
      const mintedEachTime = [];

      for (let round = 0; round < 20; round += 1) {
        const mounted = await mountField("name");
        mintedEachTime.push(mounted.ids.size);
        await mounted.dispose();
      }
      ctx.log.note("mounted and disposed the same field twenty times", {});

      // The control: each round has to have rendered something. A renderer that stopped mounting
      // would leave nothing behind for the best possible reason and pass everything below.
      expectClaim(mintedEachTime.every((count) => count > 0), {
        claimIds: ["LIF-002"],
        what: "every round mounted a field that minted at least one id",
        detail: JSON.stringify(mintedEachTime),
      });

      // And the loop's own question: the same mount must cost the same every time. A renderer that
      // minted one more id per round is the leak that a single teardown cannot show.
      expectClaim(new Set(mintedEachTime).size === 1, {
        claimIds: ["LIF-002"],
        what: "the same mount minted the same number of ids every round",
        detail: JSON.stringify(mintedEachTime),
      });

      const after = env.document.body.querySelectorAll("*").length;
      expectClaim(after === before, {
        claimIds: ["LIF-001"],
        what: "twenty rounds of mount and teardown left the document as they found it",
        detail: `${before} element(s) before, ${after} after`,
      });
    } finally {
      for (const host of Array.from(env.document.body.children)) host.remove();
    }
  },
);

battle(
  {
    claims: ["LIF-001"],
    title: "a disposed renderer holds no element, no id, and no longer reacts",
    environments: ["node"],
  },
  async (ctx) => {
    try {
      const before = env.document.body.querySelectorAll("*").length;
      const mounted = await mountField("name");
      ctx.log.note("a field mounted and about to be disposed", { ids: mounted.ids.size });

      expectClaim(mounted.ids.size > 0, {
        claimIds: ["LIF-001"],
        what: "the field minted ids while it was mounted",
        detail: JSON.stringify([...mounted.ids]),
      });

      await mounted.dispose();

      // `inspectUnmount` asks all three at once, including the one that has no registry to read:
      // an effect still subscribed re-renders into a document it no longer owns, and is caught
      // through that consequence rather than through its registration.
      const issues = inspectUnmount({
        document: env.document,
        idsWhileMounted: mounted.ids,
        elementsBeforeMount: before,
        pokeAfterDispose: () => mounted.form.f.name.set("written after teardown"),
      });

      expectClaim(issues.length === 0, {
        claimIds: ["LIF-001"],
        what: "a disposed renderer left something observable behind",
        detail: JSON.stringify(issues),
      });
    } finally {
      for (const host of Array.from(env.document.body.children)) host.remove();
    }
  },
);

battle(
  {
    claims: ["A11Y-001"],
    title: "two live forms over the same field names mint ids that do not collide",
    environments: ["node"],
  },
  async (ctx) => {
    try {
      const first = await mountField("name");
      const second = await mountField("name");
      ctx.log.note("two forms mounted over the same field name", {});

      // The control before the claim: a collision is only meaningful if both instances minted ids.
      expectClaim(first.ids.size > 0 && second.ids.size > 0, {
        claimIds: ["A11Y-001"],
        what: "both instances minted ids to compare",
        detail: `${first.ids.size} and ${second.ids.size}`,
      });

      const collisions = inspectCoexistence(first.ids, second.ids);
      expectClaim(collisions.length === 0, {
        claimIds: ["A11Y-001"],
        what: "two live instances share an id, so one field's relationships resolve to the other's DOM",
        detail: JSON.stringify(collisions),
      });

      await first.dispose();
      await second.dispose();
    } finally {
      for (const host of Array.from(env.document.body.children)) host.remove();
    }
  },
);
