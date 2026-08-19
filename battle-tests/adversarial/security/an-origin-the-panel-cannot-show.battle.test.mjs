/**
 * Where an error came from, asked of the panel that exists to answer it.
 *
 * `docs/guides/devtools.md` lists what the panel shows, and one line is a promise about provenance:
 *
 * > Each error is prefixed with its origin: `[validation]`, `[async]`, `[cross-field]`, `[server]`.
 *
 * Three of the four hold. The fourth does not, because the prefix is not the origin — it is the
 * error's `kind`, and for a server refusal the `kind` is chosen by the server:
 *
 *   a server refusal with no kind          [unknown]
 *   a server refusal with kind "taken"     [taken]
 *   a server refusal with kind "server"    [server]
 *   a server refusal with kind "validation" [validation]   ← same as a local rule
 *
 * Two costs, and the second is the sharper one.
 *
 * The ordinary case is the first line: a server answering `{ path, message }` — which is what the
 * examples show and what `_readRefusal` accepts — is labelled `[unknown]` in the one tool built to
 * say where things come from. The origin is not unknown; it arrived from a submit a moment ago.
 *
 * And a refusal that names itself `validation` is **indistinguishable from a local rule** in the
 * panel, side by side, same word. `_readRefusal` already treats one part of that payload as
 * untrusted — *"A path is still untrusted. An unsafe one is dropped and reported"* — and the `kind`
 * beside it is taken as given, then printed as provenance.
 *
 * The battle asserts what the guide promises: an error's origin is readable from the panel. It does
 * not say how — a separate field on the row, a prefix the panel controls rather than the payload, or
 * a namespace for server-chosen kinds all satisfy it.
 */

import { createForm, field, minLength } from "@modyra/core";
import { mdyFormSnapshot } from "@modyra/core/devtools";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const settle = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));

/** The panel's row for one path. */
function rowFor(form, path) {
  return (mdyFormSnapshot(form).fields ?? []).find((each) => each.path === path);
}

battle(
  {
    claims: ["SEC-002", "SUB-001"],
    title: "the panel says where an error came from",
    environments: ["node"],
  },
  async (ctx) => {
    // A form valid enough to submit, carrying a local rule that can be made to fail afterwards.
    const form = createForm(
      { local: field("abc", [minLength(3)]), fromServer: field("v") },
      { devWarnings: false },
    );

    try {
      await settle();
      // A server that names its refusal with the same word the panel uses for a local rule. Nothing
      // stops it: the kind is a string the payload carries.
      await form.submit(() => [
        { path: "fromServer", kind: "validation", message: "the server refused it" },
      ]);
      await settle();
      form.f.local.set("ab");
      await settle();

      const local = rowFor(form, "local");
      const server = rowFor(form, "fromServer");
      ctx.log.note("a local rule and a server refusal, as the panel prints them", { local: local?.errors, server: server?.errors });

      // The instrument: both errors reached the panel, or "they look the same" would be two blanks.
      expectClaim(local?.errors?.length === 1 && server?.errors?.length === 1, {
        claimIds: ["SEC-002"],
        what: "one of the two errors is not in the panel at all, so the probe is wrong before the product is",
        detail: JSON.stringify({ local: local?.errors, server: server?.errors }),
      });

      // A reader must be able to tell a rule this form ran from a refusal that arrived over the wire.
      const localOrigin = String(local.errors[0]).match(/^\[([^\]]+)\]/)?.[1];
      const serverOrigin = String(server.errors[0]).match(/^\[([^\]]+)\]/)?.[1];
      expectClaim(localOrigin !== undefined && serverOrigin !== undefined, {
        claimIds: ["SEC-002"],
        what: "the panel prints no origin prefix at all, which is a different finding from this one",
        detail: JSON.stringify({ localOrigin, serverOrigin }),
      });

      expectEqual({ theyDiffer: localOrigin !== serverOrigin }, { theyDiffer: true }, {
        claimIds: ["SEC-002", "SUB-001"],
        what: "a refusal that arrived from a server is printed with the same origin as a rule this form ran, so the tool built to say where an error came from cannot",
      });
    } finally {
      form.destroy();
    }

    // And the ordinary case: a server answering with a path and a message, as the examples do.
    const plain = createForm({ x: field("v") }, { devWarnings: false });
    try {
      await plain.submit(() => [{ path: "x", message: "already taken" }]);
      await settle();
      const printed = rowFor(plain, "x")?.errors ?? [];
      ctx.log.note("a server refusal carrying only a path and a message", { printed });

      expectEqual(printed.filter((each) => String(each).startsWith("[unknown]")), [], {
        claimIds: ["SEC-002"],
        what: "a refusal that arrived from a submit a moment ago is printed as being of unknown origin",
      });
    } finally {
      plain.destroy();
    }
  },
);
