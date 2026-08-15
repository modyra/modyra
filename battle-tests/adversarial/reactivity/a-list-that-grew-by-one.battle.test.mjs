/**
 * A dynamic form whose field list changed, which is the thing it is named for.
 *
 * `useMdyDynamicForm(fields)` takes the flat `MdyDynamicField[]` a parsed document produces and
 * returns a running form. `fields` is a React prop, so it is re-read on every render, and a
 * config-driven application changes it: a rule is edited upstream, a step of a wizard is reached, a
 * document is refetched.
 *
 * Two of those changes are handled and are the control here. A rule that changes replaces the old
 * one, and a rule the config drops stops being enforced — both without remounting, which is what
 * lets an application swap validation without losing what the user has typed.
 *
 * The third is a list that gained a name. The schema is built once, so the new name belongs to no
 * field, and the rule for it reaches `upsertValidators`, which refuses a path the form does not
 * declare. That refusal is correct where it stands. What it costs is decided by where it happens:
 * it runs inside an effect, after the render returned, so React has no call to fail — it unwinds
 * the tree instead, and the page the component was rendering goes blank.
 *
 * The battle does not require any particular repair. Rebuilding the schema, ignoring the name with
 * a diagnostic, and refusing the argument at the call all leave it green. Only the present
 * behaviour — a render that succeeds and a page that disappears after it — is red.
 */

import { JSDOM } from "jsdom";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** A DOM and the globals React reads off it, installed for one battle. */
function browser() {
  const dom = new JSDOM("<!doctype html><div id=root></div>", { url: "http://localhost/" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  return dom;
}

/** What React writes to the console while a render is in flight, kept rather than printed. */
async function quietly(run) {
  const said = [];
  const realError = console.error;
  const realWarn = console.warn;
  console.error = (...parts) => said.push(parts.map(String).join(" "));
  console.warn = (...parts) => said.push(parts.map(String).join(" "));
  try {
    return { value: await run(), said };
  } finally {
    console.error = realError;
    console.warn = realWarn;
  }
}

const settled = () => new Promise((resolve) => setTimeout(resolve, 50));

const field = (name, validators) => ({ name, kind: "text", label: name.toUpperCase(), ...(validators ? { validators } : {}) });

battle(
  {
    claims: ["API-001", "DYN-001"],
    title: "a rule the config changes replaces the old one, and a rule it drops stops applying",
    environments: ["node"],
  },
  async (ctx) => {
    browser();
    const React = (await import("react")).default;
    const { createRoot } = await import("react-dom/client");
    const { flushSync } = await import("react-dom");
    const { useMdyDynamicForm } = await import("@modyra/react");

    let form = null;
    const Probe = ({ fields }) => {
      form = useMdyDynamicForm(fields);
      return null;
    };

    const root = createRoot(document.getElementById("root"));
    const render = async (fields) => {
      await quietly(async () => {
        flushSync(() => root.render(React.createElement(Probe, { fields })));
        await settled();
      });
    };
    const kinds = (name) => form.errorsFor(name)().map((each) => each.kind);

    // Both names are declared by the first list, so nothing below is about a name the form never
    // knew — that is the next battle's question.
    await render([field("email", { required: true }), field("phone", { required: true })]);
    ctx.log.note("the rules the first list declared", { email: kinds("email"), phone: kinds("phone") });

    expectClaim(kinds("email").length > 0 && kinds("phone").length > 0, {
      claimIds: ["DYN-001"],
      what: "a required rule from the config did not apply, so the changes below are unmeasurable",
      detail: JSON.stringify({ email: kinds("email"), phone: kinds("phone") }),
    });

    // A rule that changed. `minLength` is not `required`, so an empty value now has nothing to say.
    await render([field("email", { minLength: 5 }), field("phone", { required: true })]);
    expectEqual(kinds("email"), [], {
      claimIds: ["API-001"],
      what: "a rule the config replaced was still enforced alongside its replacement",
    });

    form.f.email.set("abc");
    expectClaim(kinds("email").length > 0, {
      claimIds: ["API-001"],
      what: "the rule the config put in place of the old one was not applied",
      detail: JSON.stringify(kinds("email")),
    });

    // A rule the config dropped entirely, on a field that is still declared.
    await render([field("email", { minLength: 5 }), field("phone")]);
    expectEqual(kinds("phone"), [], {
      claimIds: ["API-001"],
      what: "a rule the config no longer declares is still refusing the field's value",
      detail: JSON.stringify(form.errorsFor("phone")().map((each) => each.message)),
    });
  },
);

battle(
  {
    claims: ["API-001"],
    title: "a field list that gained a name does not take the page down with it",
    open: "reported, not enforced: finding 36, open in battle-tests/reports/open-findings.md",
    environments: ["node"],
  },
  async (ctx) => {
    browser();
    const React = (await import("react")).default;
    const { createRoot } = await import("react-dom/client");
    const { flushSync } = await import("react-dom");
    const { useMdyDynamicForm } = await import("@modyra/react");

    // The component renders something, because "the page went blank" is only observable if there
    // was something on it.
    const Probe = ({ fields }) => {
      useMdyDynamicForm(fields);
      return React.createElement("p", { id: "alive" }, `showing ${fields.length}`);
    };

    const root = createRoot(document.getElementById("root"));
    const page = () => document.getElementById("root").innerHTML;

    const one = [field("email", { required: true })];
    await quietly(async () => {
      flushSync(() => root.render(React.createElement(Probe, { fields: one })));
      await settled();
    });

    // The control: the component really did put something on the page, so an empty root afterwards
    // is the change rather than a component that never rendered.
    expectClaim(page().includes("showing 1"), {
      claimIds: ["API-001"],
      what: "the component rendered nothing to begin with, so this battle cannot see it go away",
      detail: page(),
    });

    // The config gained a field. Either the hook copes, or it refuses the argument where that
    // argument arrives — which is at this call, synchronously, with the page still standing.
    const two = [...one, field("phone", { required: true })];
    let refusedAtTheCall = null;
    const { said } = await quietly(async () => {
      try {
        flushSync(() => root.render(React.createElement(Probe, { fields: two })));
      } catch (error) {
        refusedAtTheCall = error;
      }
      await settled();
    });

    const survived = page().includes("showing");
    ctx.log.note("what the page holds after the list grew", {
      html: page() || "(empty)",
      refusedAtTheCall: refusedAtTheCall === null ? null : String(refusedAtTheCall.message).slice(0, 120),
      reactSaid: said.filter((line) => line.includes("modyra")).slice(0, 1),
    });

    expectClaim(survived || refusedAtTheCall !== null, {
      claimIds: ["API-001"],
      what: "adding a field to the config emptied the page, and the call that was given it returned normally",
      detail: JSON.stringify({
        page: page() || "(empty)",
        said: said.filter((line) => line.includes("modyra")).slice(0, 1),
      }),
    });
  },
);
