/**
 * The harness is enough for a framework runtime to mount into.
 *
 * A harness with nothing exercising it is a list somebody believed: this file is the exercise. It
 * mounts a real Vue component and reads the result out of the document, which is the only claim that
 * matters — that a component written against this contract can be drawn and then inspected here.
 *
 * **Each global is asserted to be missing before installation and present after**, because a name
 * that jsdom happens to leak into the global scope some other way would make this file pass while
 * the harness did nothing. The list is the harness's, not a copy: a name added there and forgotten
 * here would otherwise go unexercised, which is the shape a list of globals is most likely to take.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals, runtimeGlobals } from "./support/dom-env.mjs";

test("the runtime globals are absent before this harness and present after", () => {
  const before = runtimeGlobals.filter((name) => globalThis[name] !== undefined);
  installDomGlobals();
  const after = runtimeGlobals.filter((name) => globalThis[name] === undefined);

  assert.deepEqual(before, [], `already global before the harness ran, so this file cannot show the harness did it: ${before.join(" ")}`);
  assert.deepEqual(after, [], `the harness names it and did not install it: ${after.join(" ")}`);
  assert.ok(runtimeGlobals.length > 0, "the harness installs nothing, so nothing below is about a harness");
});

test("a Vue component mounts and the document can be read back", async () => {
  installDomGlobals();
  const { createApp, h } = await import("vue");

  const host = document.createElement("div");
  document.body.append(host);
  createApp({
    props: { label: String },
    setup(props) {
      return () => h("div", { class: "probe" }, [
        h("label", { class: "probe__label" }, props.label),
        // A conditional, because an absent branch is drawn as a comment node and a runtime that
        // cannot construct one fails on a page that looks fine until something is hidden.
        props.label ? h("input", { class: "probe__control", type: "text" }) : null,
      ]);
    },
  }, { label: "Given" }).mount(host);
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(host.querySelector(".probe__label")?.textContent, "Given", "the component drew no caption, so nothing was mounted");
  assert.equal(host.querySelector(".probe__control")?.getAttribute("type"), "text", "the control is missing or carries no type");
});
