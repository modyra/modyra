/**
 * No word a renderer draws is a value that escaped instead of a value that was written.
 *
 * **This tier reads geometry and never reads text.** The sweeps compare heights, classes and
 * attributes across the three renderers; the visual baselines pin each renderer against its own
 * past. A word is invisible to both — so `null` written where a sentence belongs survives every
 * check the board has, in every renderer at once, for as long as nobody looks.
 *
 * What is hunted is not a wrong word but a word that is not a word: `null`, `undefined`, `NaN`,
 * `[object Object]`. Each is a value that reached the page through a channel that stringifies
 * whatever it is given, and each is legible to a person — a tooltip that says "null", a label that
 * says "undefined". They are not a matter of taste and need no decision to call them defects, which
 * is why this asks for them and not for agreement about phrasing.
 *
 * **A property is not an attribute, and this is the shape that produces them.** `[attr.title]="null"`
 * removes the attribute; assigning `null` to the `title` property stores the string "null", because
 * the property is a `DOMString` and coercion is the only thing it can do. The absent branch — the
 * ordinary case, the one with nothing to say — is the one that writes the word.
 *
 * Every kind is mounted in its resting state, with a label and nothing else, because that is where
 * the absent branches are: no value, no error, no capability asked for. Text nodes and attributes are
 * both read, since the same escape reaches the page through either.
 *
 * Claims under attack: UI-011, A11Y-004.
 */
import { expect, test } from "@playwright/test";
import { MDY_WIDGET_KINDS } from "@modyra/widgets";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }];

for (const host of HOSTS) {
  test(`no word is a value that escaped, ${host.name}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1_200, height: 900 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const escaped: string[] = [];
    let read = 0;

    for (const kind of MDY_WIDGET_KINDS) {
      const id = `escaped_${kind}`;
      await page.evaluate(({ api, mountId, one }) => {
        (window as never as Api)[api].mountFields(mountId, [one] as never);
      }, { api: host.api, mountId: id, one: { name: "f", kind, label: "L", options: OPTIONS } });
      await page.locator(`[data-form="${id}"]`).waitFor({ timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(60);

      const found = await page.evaluate(({ mountId, of }) => {
        const root = document.querySelector(`[data-form="${mountId}"]`);
        if (root === null) return null;
        const notAWord = /^(null|undefined|NaN|\[object Object\])$/;
        const out: string[] = [];
        for (const element of [root, ...root.querySelectorAll("*")]) {
          for (const attribute of [...element.attributes]) {
            if (!notAWord.test(attribute.value.trim())) continue;
            const named = element.getAttribute("class") ?? element.tagName.toLowerCase();
            out.push(`${of}: ${attribute.name}="${attribute.value}" on ${named}`);
          }
        }
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
          const word = (node.textContent ?? "").trim();
          if (notAWord.test(word)) out.push(`${of}: the words "${word}" are drawn`);
        }
        return out;
      }, { mountId: id, of: kind });

      // A kind that never mounted contributes no finding, and a run of those reads as a clean page.
      if (found === null) continue;
      read += 1;
      escaped.push(...found);
    }

    expect(
      read,
      `${host.name} mounted almost nothing, so the absence below is this run finding nothing to read `
      + "rather than the renderer drawing no escaped value",
    ).toBeGreaterThan(MDY_WIDGET_KINDS.length - 2);

    expect(
      escaped,
      `${host.name} draws a value where a word belongs: ${JSON.stringify(escaped)}. A person reads `
      + "these — a tooltip that says \"null\", a label that says \"undefined\" — and the channel that "
      + "wrote them stringifies whatever it is handed, so the branch with nothing to say is the one "
      + "that speaks. An attribute is removed by binding it as an attribute; a property can only coerce.",
    ).toEqual([]);
  });
}
