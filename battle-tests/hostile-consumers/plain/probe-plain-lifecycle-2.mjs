/**
 * Loops 59–63: the Plain renderer, using the API it actually exposes (`form`, `reactivity`,
 * `dispose`), and measuring the consequence of the id collision its own documentation describes.
 */
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Event = dom.window.Event;
globalThis.KeyboardEvent = dom.window.KeyboardEvent;

const { mountMdyForm } = await import("@modyra/plain");

const line = (label, value) => console.log(`${label}: ${value}`);
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

const container = () => {
  const element = document.createElement("div");
  document.body.append(element);
  return element;
};

const danglingReferences = (root) => {
  const dangling = [];
  for (const element of root.querySelectorAll("*")) {
    for (const attribute of ["aria-controls", "aria-describedby", "aria-labelledby", "aria-errormessage", "for"]) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      for (const id of value.split(/\s+/)) {
        if (id && !document.getElementById(id)) dangling.push(`${element.tagName.toLowerCase()}[${attribute}=${id}]`);
      }
    }
  }
  return dangling;
};

// ── 59. A keyed row: mount, edit, remove the row, and look at what is left in the DOM.
{
  const host = container();
  const mounted = mountMdyForm(
    host,
    [
      { name: "rows.a.code", kind: "text", label: "Code", validators: { required: true } },
      { name: "rows.a.note", kind: "text", label: "Note" },
    ],
    { collections: [{ path: "rows", kind: "record" }] },
  );
  await settle();

  line("59. controls mounted", String(host.querySelectorAll("input").length));
  line("59. value", JSON.stringify(mounted.form.getValue()));

  const input = host.querySelector("input");
  input.focus();
  input.value = "typed";
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  await settle();
  line("59. after typing", JSON.stringify(mounted.form.getValue()));

  mounted.form.f.rows.remove("a");
  await settle();
  line("59. after removing the row", `value=${JSON.stringify(mounted.form.getValue())} inputs=${host.querySelectorAll("input").length} focusInDocument=${document.contains(document.activeElement)} dangling=${JSON.stringify(danglingReferences(host))}`);

  mounted.form.f.rows.upsert("a", { code: "back", note: "" });
  await settle();
  line("59. after re-declaring it", `value=${JSON.stringify(mounted.form.getValue())} inputs=${host.querySelectorAll("input").length} inputValue=${host.querySelector("input")?.value}`);

  mounted.dispose();
  await settle();
  line("59. after dispose", `children=${host.children.length} dangling=${JSON.stringify(danglingReferences(host))}`);
  host.remove();
}

// ── 60. Two forms without a prefix: what a label points at.
{
  const first = container();
  const second = container();
  const fields = [{ name: "code", kind: "text", label: "Code" }];
  const a = mountMdyForm(first, fields);
  const b = mountMdyForm(second, fields);
  await settle();

  const labelInSecond = second.querySelector("label");
  const target = document.getElementById(labelInSecond.getAttribute("for"));
  line("60. the second form's label resolves into", first.contains(target) ? "the FIRST form" : "its own form");
  line("60. describedby target", (() => {
    const input = second.querySelector("input");
    const described = input.getAttribute("aria-describedby");
    const node = described ? document.getElementById(described.split(/\s+/)[0]) : null;
    return node ? (first.contains(node) ? "the FIRST form" : "its own form") : "none";
  })());

  a.dispose();
  await settle();
  line("60. after disposing the first", `secondsLabelTarget=${document.getElementById(labelInSecond.getAttribute("for")) ? "resolves" : "DANGLING"} dangling=${JSON.stringify(danglingReferences(second))}`);
  b.dispose();
  first.remove();
  second.remove();
}

// ── 61. The same two forms, prefixed as the option documents.
{
  const first = container();
  const second = container();
  const fields = [{ name: "code", kind: "text", label: "Code" }];
  const a = mountMdyForm(first, fields, { idPrefix: "a" });
  const b = mountMdyForm(second, fields, { idPrefix: "b" });
  await settle();

  const labelInSecond = second.querySelector("label");
  const target = document.getElementById(labelInSecond.getAttribute("for"));
  line("61. prefixed — the second form's label resolves into", second.contains(target) ? "its own form" : "the FIRST form");
  a.dispose();
  await settle();
  line("61. after disposing the first", `dangling=${JSON.stringify(danglingReferences(second))}`);
  b.dispose();
  first.remove();
  second.remove();
}

// ── 62. Mounting a cell whose row is not declared by the collections map.
{
  const host = container();
  let threw = null;
  let mounted = null;
  try {
    mounted = mountMdyForm(host, [{ name: "rows.ghost.code", kind: "text", label: "Ghost" }], {
      collections: [{ path: "rows", kind: "record" }],
    });
    await settle();
  } catch (error) {
    threw = error.message;
  }
  line("62. a cell of an undeclared row", threw ? `THREW ${threw}` : `inputs=${host.querySelectorAll("input").length} value=${JSON.stringify(mounted.form.getValue())}`);
  mounted?.dispose();
  host.remove();
}

// ── 63. Disposing twice, and reading the form afterwards.
{
  const host = container();
  const mounted = mountMdyForm(host, [{ name: "code", kind: "text", label: "Code" }]);
  await settle();
  mounted.dispose();
  let secondThrew = null;
  try {
    mounted.dispose();
  } catch (error) {
    secondThrew = error.message;
  }
  let read = null;
  try {
    read = JSON.stringify(mounted.form.getValue());
  } catch (error) {
    read = `THREW ${error.message}`;
  }
  line("63. dispose twice", secondThrew ? `THREW ${secondThrew}` : "no error");
  line("63. read after dispose", read);
  host.remove();
}
