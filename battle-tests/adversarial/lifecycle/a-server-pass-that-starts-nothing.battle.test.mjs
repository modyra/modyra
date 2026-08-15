/**
 * The render that happens where there is no browser.
 *
 * `useMdyForm` builds the form during render and leaves it inert: `createForm(schema(), { …options,
 * autoActivate: false })`, with `activate()` moved into an effect. The stated reason is the server —
 * "the server-rendered pass never runs `useEffect` at all, so nothing client-only ever starts".
 *
 * That is a promise about a process, not about a component: no DOM, no timer, no storage read, no
 * network call, from any of the four doors this package publishes. It holds today, and it is the
 * kind of promise a refactor breaks without a symptom — writing the override as
 * `{ autoActivate: false, …options }` instead of the other way round would let a consumer's own
 * `autoActivate: true` reach the server, and the first thing anyone would notice is a draft read
 * against a storage that does not exist there.
 *
 * So the battle asks for that case by name: a consumer who *wants* activation still gets a server
 * pass that starts nothing. Its premise is that the process really has no browser in it, which is
 * asserted first — a leaked global from a neighbouring battle would make everything below vacuous.
 */

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** What a browser has and a server does not. */
const BROWSER_GLOBALS = Object.freeze([
  "window", "document", "localStorage", "sessionStorage", "requestAnimationFrame", "HTMLElement",
]);

const OPTIONS = Object.freeze([
  Object.freeze({ value: "a", label: "Alpha" }),
  Object.freeze({ value: "b", label: "Beta" }),
]);

battle(
  {
    claims: ["LIF-001", "PER-001"],
    title: "a server pass builds every door's form and starts none of them",
    environments: ["node"],
  },
  async (ctx) => {
    // The premise. Everything below measures a server only if this process is one.
    const present = BROWSER_GLOBALS.filter((name) => name in globalThis);
    ctx.log.note("browser globals in this process", { present });

    expectEqual(present, [], {
      claimIds: ["LIF-001"],
      what: "this process has a browser in it, so nothing below is a measurement of a server pass",
    });

    // The import itself, before any render: a module that reaches for a browser at load time makes
    // the package unusable on a server whatever its hooks do.
    const m = await import("@modyra/react");
    const React = (await import("react")).default;
    const { renderToString } = await import("react-dom/server");

    /** A storage that reports being touched rather than answering. */
    const touched = [];
    const storage = {
      read: (key) => { touched.push(`read:${key}`); return null; },
      write: (key) => { touched.push(`write:${key}`); },
      remove: (key) => { touched.push(`remove:${key}`); },
    };
    let asyncRuns = 0;
    const lookup = () => null;
    const handlers = new Proxy({}, { get: () => () => {}, has: () => true });

    /** Every published door, rendered once as a server renders it. */
    const doors = [
      ["useMdyForm, with a draft and an async rule", () => {
        const form = m.useMdyForm(() => ({
          email: m.field("", [m.required()], {
            asyncValidators: [async () => { asyncRuns += 1; return []; }],
          }),
        }), { draft: { key: "ssr", storage }, devWarnings: false });
        return `valid:${form.state.valid()}`;
      }],
      ["useMdyDynamicForm", () => {
        const form = m.useMdyDynamicForm([
          { name: "who", kind: "text", label: "Who", validators: { required: true } },
        ]);
        return `fields:${Object.keys(form.f).join(",")}`;
      }],
      ["useMdySelect", () => {
        const api = m.useMdySelect({ widgetId: "s", options: OPTIONS, onChange: () => {} }, lookup, handlers);
        return `open:${api.state.open}`;
      }],
      ["useMdyOptionField", () => {
        const form = m.useMdyForm(() => ({ pick: m.field(null) }));
        const api = m.useMdyOptionField(form.f.pick, { widgetId: "o", options: OPTIONS });
        return `value:${JSON.stringify(api.state.value ?? null)}`;
      }],
      // The case a reordered spread would break, asked for by name.
      ["useMdyForm, with the consumer asking for activation", () => {
        const form = m.useMdyForm(() => ({ a: m.field("") }), {
          autoActivate: true,
          draft: { key: "wanted", storage },
          devWarnings: false,
        });
        return `fields:${Object.keys(form.f).join(",")}`;
      }],
    ];

    const rendered = [];
    for (const [name, body] of doors) {
      const Probe = () => React.createElement("i", null, body());
      rendered.push([name, renderToString(React.createElement(Probe))]);
    }
    ctx.log.note("what each door rendered on a server", { rendered });

    // Each door produced markup rather than nothing, so the assertions below are about a render that
    // happened.
    for (const [name, html] of rendered) {
      expectClaim(html.startsWith("<i>") && html.length > "<i></i>".length, {
        claimIds: ["LIF-001"],
        what: `${name} rendered nothing on a server`,
        detail: html,
      });
    }

    // A draft is read when a form activates. On a server it must not have been.
    await new Promise((resolve) => setTimeout(resolve, 120));
    ctx.log.note("what a server pass started", { touched, asyncRuns });

    expectEqual(touched, [], {
      claimIds: ["PER-001"],
      what: "a server pass touched a draft storage",
    });

    expectEqual(asyncRuns, 0, {
      claimIds: ["LIF-001"],
      what: "a server pass started an async validator",
    });
  },
);
