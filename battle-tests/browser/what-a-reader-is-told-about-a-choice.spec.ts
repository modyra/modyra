/**
 * What the accessibility tree says about a field that holds several values.
 *
 * Every accessibility check in this suite until now has read the **DOM** — the attribute a renderer
 * set, against a published rule. This reads what the browser **computed from it**, which is the thing
 * an assistive technology is handed and the only place a discarded attribute becomes visible.
 *
 * The two questions it asks are the ones neither the DOM nor the specification can answer alone.
 *
 * **Can a reader tell two controls apart?** A name is not decoration: it is the whole of what
 * distinguishes one button from another to someone who cannot see which chip it sits in. The rule is
 * general and stated as such — *no two operable nodes in one field carry the same accessible name* —
 * rather than as a list of the names this control happens to use.
 *
 * Measured, identical in all three renderers, on a field holding two values:
 *
 *     listitem "Alfa, 2"    button "One fewer"   button "One more"   button "Remove Alfa"
 *     listitem "Beta"       button "One fewer"   button "One more"   button "Remove Beta"
 *
 * **The removal names its value and the steppers do not**, in the same chip, in the same renderer. So
 * the renderer already knows how — and the two it leaves unnamed are the ones that matter most,
 * because stepping down from one removes the value. The control that can delete is the one that does
 * not say what it would delete, and a reader meets four buttons that sound like two.
 *
 * **And do the tree and the DOM agree?** ADR 0142 records that the opener must contain nothing
 * operable, and records that it is asserted against the DOM *because Chromium's tree preserves the
 * nesting* and would pass. That makes the two readings independent, so this asserts they **match**:
 * where the tree holds an operable node the DOM does not, or the reverse, one of them is lying and no
 * single-sided check can say which.
 *
 * ## What this does not cover, said here rather than discovered later
 *
 * **CDP is Chromium.** That Chromium's tree says this is measured; that Firefox and WebKit agree is
 * inference. A reading here is one engine of three.
 *
 * **A tree is not a voice.** Reading order, browse mode, what a person actually hears — none of it is
 * here, and no amount of this closes that.
 *
 * Claims under attack: A11Y-001, A11Y-004.
 */

import { expect, test } from "@playwright/test";

import { HOSTS } from "./bench";
import { whatAReaderWouldHear, everythingUnder, asLines } from "../harness/what-a-reader-would-hear.mjs";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

/** Roles a person can act on, as the tree names them. */
const OPERABLE = new Set(["button", "combobox", "link", "checkbox", "radio", "textbox", "slider", "spinbutton"]);

const mount = async (page: import("@playwright/test").Page, host: (typeof HOSTS)[number], id: string) => {
  await page.evaluate(({ api, id }) => {
    (window as never as Api)[api].mountFields(id, [{
      name: "m", kind: "multiselect", label: "Scelte", mode: "multi", clearable: true,
      options: [{ value: "a", label: "Alfa" }, { value: "b", label: "Beta" }],
      initialValue: ["a", "a", "b"],
    }] as never);
  }, { api: host.api, id });
  await page.locator(`[data-form="${id}"]`).waitFor({ timeout: 5_000 });
  await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
  await page.waitForTimeout(700);
};

for (const host of HOSTS) {
  test(`a reader can tell two controls apart, ${host.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1_200, height: 700 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    await mount(page, host, "reader");

    const { roots } = await whatAReaderWouldHear(page, '[data-form="reader"]');
    const all = roots.flatMap((node: never) => everythingUnder(node)) as Array<{
      role: string; name: string; ignored: boolean;
    }>;
    const operable = all.filter((node) => !node.ignored && OPERABLE.has(node.role));

    // The premise: this field put operable things in the tree at all. Every assertion below is true
    // of a page that reached the tree as nothing.
    expect(
      operable.length,
      `${host.name} put ${operable.length} operable node(s) in the accessibility tree for a field `
      + `holding two values. There is nothing here to tell apart.\n${asLines(roots).join("\n")}`,
    ).toBeGreaterThan(4);

    // Nothing operable may be nameless: a reader meets it as "button" and nothing else.
    expect(
      operable.filter((node) => node.name.trim() === "").map((node) => node.role),
      `${host.name}: operable node(s) reached the tree with no accessible name at all.`,
    ).toEqual([]);

    const byName = new Map<string, number>();
    for (const node of operable) byName.set(node.name, (byName.get(node.name) ?? 0) + 1);
    const shared = [...byName.entries()]
      .filter(([, times]) => times > 1)
      .map(([name, times]) => `"${name}" ×${times}`);

    expect(
      shared,
      `${host.name}: ${shared.length} accessible name(s) are carried by more than one control — `
      + `${shared.join(", ")}. A person who cannot see which chip a button sits in has only its name `
      + "to go on, so two controls that sound alike are one control they cannot choose between. The "
      + "removal in the same chip says which value it removes, so the renderer knows how; and the "
      + "unnamed pair are the steppers, where stepping down from one removes the value.\n"
      + asLines(roots).join("\n"),
    ).toEqual([]);
  });

  test(`the tree and the DOM agree about what the opener holds, ${host.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1_200, height: 700 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    await mount(page, host, "agree");

    const { roots } = await whatAReaderWouldHear(page, '[data-form="agree"]');
    const all = roots.flatMap((node: never) => everythingUnder(node)) as Array<{
      role: string; ignored: boolean; children: Array<{ role: string; ignored: boolean; name: string }>;
    }>;
    const combobox = all.find((node) => node.role === "combobox" && !node.ignored);

    expect(combobox, `${host.name} published no combobox, so there is no opener to look inside`).toBeDefined();

    const inTree = (everythingUnder(combobox as never) as Array<{ role: string; ignored: boolean; name: string }>)
      .filter((node) => node !== (combobox as never) && !node.ignored && OPERABLE.has(node.role))
      .map((node) => `${node.role} "${node.name}"`);

    const inDom = await page.evaluate(() => {
      const opener = document.querySelector('[data-form="agree"] [aria-haspopup], [data-form="agree"] [role="combobox"]');
      if (opener === null) return null;
      const operable = 'button,[role="button"],a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';
      return Array.from(opener.querySelectorAll(operable))
        .map((element) => `${element.tagName.toLowerCase()} "${(element.getAttribute("aria-label") ?? element.textContent ?? "").trim()}"`);
    });

    expect(inDom, `${host.name}: no opener in the DOM to compare the tree against`).not.toBeNull();

    // The point of the file. Each side is checked elsewhere; only together do they catch an attribute
    // the browser discarded, or a nesting the tree invented.
    expect(
      { tree: inTree.length, dom: inDom!.length },
      `${host.name}: the accessibility tree holds ${inTree.length} operable node(s) inside the opener `
      + `(${inTree.join(", ") || "none"}) and the DOM holds ${inDom!.length} `
      + `(${inDom!.join(", ") || "none"}). One of the two is not describing this control: the tree drops `
      + "what a role forbids without saying so, and the DOM keeps what a parser would have refused.",
    ).toEqual({ tree: inDom!.length, dom: inDom!.length });
  });
}

test("a part is named in every renderer, or in none", async ({ page }) => {
  test.setTimeout(180_000);
  const named = new Map<string, Record<string, string>>();

  for (const host of HOSTS) {
    await page.setViewportSize({ width: 1_200, height: 700 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    await mount(page, host, "across");

    const { roots } = await whatAReaderWouldHear(page, '[data-form="across"]');
    const all = roots.flatMap((node: never) => everythingUnder(node)) as Array<{
      role: string; name: string; ignored: boolean;
    }>;
    // One role of each kind, by its first appearance: enough to ask whether the renderers agree that
    // this part speaks, without depending on how many of them a fixture happens to draw.
    for (const role of ["list", "combobox", "status"]) {
      const found = all.find((node) => node.role === role && !node.ignored);
      if (found === undefined) continue;
      if (!named.has(role)) named.set(role, {});
      named.get(role)![host.name] = found.name;
    }
  }

  expect(named.size, "no renderer published any of these roles, so nothing is being compared").toBeGreaterThan(1);

  const differs = [...named.entries()]
    .filter(([, byHost]) => Object.keys(byHost).length === HOSTS.length)
    .filter(([, byHost]) => new Set(Object.values(byHost).map((name) => name !== "")).size > 1)
    .map(([role, byHost]) => `${role}: ${Object.entries(byHost).map(([h, n]) => `${h}=${n === "" ? "(unnamed)" : `"${n}"`}`).join(", ")}`);

  expect(
    differs,
    `${differs.length} part(s) speak in one renderer and stay silent in another:\n${differs.join("\n")}\n\n`
    + "One contract, one document, and a person moving between two applications built on it hears a "
    + "different form. Whether the part should be named is a decision; that the three disagree is not.",
  ).toEqual([]);
});
