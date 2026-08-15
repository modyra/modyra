import { parseDynamicForm } from "@modyra/core";
import { expect, test } from "@playwright/test";

/**
 * A field name a document may declare and a page cannot draw.
 *
 * A widget id is built from a field's name, and the renderer states the rule in one sentence:
 *
 *     "a b" cannot be a widget id: it must be non-empty, and may contain neither whitespace nor "__".
 *
 * Both halves have the same reason — whitespace splits an attribute list, and `aria-describedby` is a
 * space-separated list of ids — and the parser enforces **one of them**. A name containing `__` is
 * refused where a document is read, with a diagnostic and `strict.ok === false`. A name containing a
 * space, a tab or a newline is accepted, kept, and reported as nothing.
 *
 * So an author runs the gate, is told the document is fine, saves it, and the page will not draw the
 * field. The half that is enforced proves the parser knows about widget ids; the half that is not is
 * in the same sentence.
 *
 * The renderer's refusal is good — it names the field, the rule and the reason — and this battle does
 * not ask for it to accept the name. It asks for the author to be told at the gate they ran first.
 *
 * The dot is the same disagreement the other way round and is measured here rather than asserted: the
 * parser refuses `a.b` as an unsafe name and the renderer mounts it. A renderer more permissive than
 * the contract loses nobody a document that passed.
 */

/** What every id the page builds has to survive. */
const FORBIDDEN_BY_THE_RENDERER = ["a b", "a\tb", "a\nb"];

test.beforeEach(async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as { battleReady?: boolean }).battleReady === true);
});

test("a name the page can carry is one it mounts", async ({ page }) => {
  // The control. Without it every refusal below would also be true of a renderer that mounts nothing.
  const mounted = await page.evaluate(() =>
    window.battle.mountFields("ok-name", [{ name: "plain", kind: "text", label: "L" }] as never));
  expect(mounted, JSON.stringify(mounted)).toMatchObject({ mounted: true });
});

test("a name the page refuses is one the document was told about", async ({ page }) => {
  const passed: Array<Record<string, unknown>> = [];

  for (const [index, name] of FORBIDDEN_BY_THE_RENDERER.entries()) {
    // What the page does with it.
    const rendered = await page.evaluate(
      ({ mountId, n }) => window.battle.mountFields(mountId, [{ name: n, kind: "text", label: "L" }] as never),
      { mountId: `bad-name-${index}`, n: name },
    );

    // The premise: the renderer really does refuse it, and says why. If it ever mounts these, this
    // battle is describing a world that no longer exists and should be read again rather than fixed.
    expect(rendered, `the renderer mounted ${JSON.stringify(name)}`).toMatchObject({ mounted: false });
    expect(String((rendered as Record<string, unknown>).message), JSON.stringify(rendered))
      .toContain("widget id");

    // And what the gate an author runs first says about the same document. The parse runs here rather
    // than in the page: the page has no module resolution, and the question is about the contract
    // rather than about anything the browser does with it.
    const result = parseDynamicForm(
      { version: 3, fields: [{ name, kind: "text", label: "L" }] },
      { mode: "strict" },
    );
    const parsed = {
      ok: result.ok,
      kept: (result.fields ?? []).length,
      codes: (result.diagnostics ?? []).map((each) => each.code),
    };

    if (parsed.ok === true && parsed.codes.length === 0) passed.push({ name, parsed, rendered });
  }

  // Either repair closes it: refuse the name where the document is read, or draw the field. What this
  // refuses is a document that passes strict and cannot be rendered.
  expect(passed, JSON.stringify(passed, null, 1)).toEqual([]);
});

test("the half of the same rule the parser does enforce", async ({ page }) => {
  // `__` is in the same sentence of the renderer's message, and the parser refuses it — which is what
  // makes the whitespace half a gap rather than a decision. If this ever stops being true, the
  // finding above is a different one.
  const parsed = ["a__b", "__b", "a__"].map((name) => {
    const result = parseDynamicForm(
      { version: 3, fields: [{ name, kind: "text", label: "L" }] },
      { mode: "strict" },
    );
    return { name, ok: result.ok, codes: (result.diagnostics ?? []).map((each) => each.code) };
  });

  expect(parsed.every((each) => each.ok === false && each.codes.length > 0), JSON.stringify(parsed)).toBe(true);
});
