/**
 * A field and a widget keep answering after React Strict Mode's rehearsal.
 *
 * In development Strict Mode mounts a component, runs its effect cleanups, and mounts it again with
 * the same memoised values. Anything a cleanup ends for good is therefore ended before the person
 * sees the component at all: the field renders once and then never again, whatever is written to it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><div id='root'></div>", { pretendToBeVisual: true });
for (const name of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"]) {
  if (globalThis[name] === undefined) globalThis[name] = dom.window[name];
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
const { createForm, field, useMdyField, useMdySelectField } = await import("../dist/index.js");

async function mountStrict(element) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(React.createElement(React.StrictMode, null, element)));
  return { host, root };
}

test("useMdyField still re-renders after Strict Mode's mount, cleanup and remount", async () => {
  const form = createForm({ name: field("") });
  const seen = [];
  function Row() {
    const name = useMdyField(form.f.name);
    seen.push(name.value);
    return React.createElement("span", null, name.value);
  }
  const { host, root } = await mountStrict(React.createElement(Row));
  await act(async () => form.f.name.set("Ada"));
  assert.equal(host.textContent, "Ada");
  assert.equal(seen.at(-1), "Ada");
  await act(async () => root.unmount());
});

test("a widget controller still answers after Strict Mode's mount, cleanup and remount", async () => {
  const form = createForm({ city: field(null) });
  const options = [{ value: "rome", label: "Rome" }, { value: "oslo", label: "Oslo" }];
  function Picker() {
    const select = useMdySelectField(form.f.city, { options, widgetId: "city" });
    return React.createElement("span", null, String(select.state.selectedValue ?? ""));
  }
  const { host, root } = await mountStrict(React.createElement(Picker));
  await act(async () => form.f.city.set("oslo"));
  assert.equal(host.textContent, "oslo");
  await act(async () => root.unmount());
});
