/**
 * Whether a field that declares it conceals what is typed actually conceals it.
 *
 * Three kinds declare which native control a browser should draw for them, and one of the three also
 * declares that what a person types into it is hidden. Those two declarations are the whole of what
 * makes a password field a password field: the platform masks the characters, offers to save them in
 * a password manager rather than in form autofill, and keeps them out of the keyboard's suggestion
 * strip on a phone.
 *
 * **Nothing asked for either.** Of everything the catalogue declares, these were among the last three
 * with no check demanding them — and they are the pair with the sharpest consequence, because the
 * failure is silent in the direction that matters: a field that draws an ordinary text box for a
 * password looks fine to whoever built the form and shows the password to whoever is standing behind
 * the person filling it in.
 *
 * **They are also invisible to the other instrument.** The differential suite compares six reactivity
 * implementations against a shared baseline, and it compares what a form *means* — what it holds,
 * what it will submit, what is invalid. Which control a renderer draws is not in that comparison, so
 * a field that never masked anything would agree with every runtime perfectly.
 *
 * **The control is free.** Three kinds declare three different values, so a renderer that hardcodes
 * one fails on the other two. There is no single answer that passes all three by accident — and the
 * one that matters is the one a wrong answer exposes.
 *
 * **What was typed is never read back.** Proving the box takes characters needs them typed; nothing
 * here needs them returned, and a value declared hidden that crosses into a test process can end up
 * in a failure message, in a run's artefacts, or in whatever reads those later. A reading layer that
 * cannot read a concealed value is the version of this that no downstream consumer can undo — and the
 * same rule belongs anywhere a tool collects what a field holds, where it is easier to forget because
 * nobody is looking at that tool.
 *
 * **What is asked is the type the browser was given, not how the masking looks.** How a platform draws
 * a hidden character is the platform's business and differs between them; that the control is the kind
 * the catalogue named is what makes the platform do any of it at all.
 *
 * Claims under attack: UI-005, A11Y-004.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;
type Contract = { controlType?: string; concealed?: boolean };

const CONTRACTS = MDY_WIDGET_CONTRACTS as unknown as Record<string, Contract>;
const TYPED_KINDS = Object.keys(CONTRACTS).filter((kind) => typeof CONTRACTS[kind].controlType === "string");
/** Types the platform masks. A kind declaring concealment has to be drawn as one of them. */
const MASKING = new Set(["password"]);

for (const host of HOSTS) {
  test(`a field is drawn as the control its kind declares, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1_200, height: 700 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    // Without kinds that declare a control type, this file is about nothing.
    expect(TYPED_KINDS.length, "no kind declares which control a browser should draw").toBeGreaterThan(1);
    // And without more than one distinct value, a renderer that hardcodes one would pass.
    expect(
      new Set(TYPED_KINDS.map((kind) => CONTRACTS[kind].controlType)).size,
      `the kinds declaring a control type all declare the same one, so a renderer that writes it `
      + "once cannot be told from one that read the catalogue",
    ).toBeGreaterThan(1);

    const wrongControl: string[] = [];
    const notConcealed: string[] = [];
    const notDrawn: string[] = [];

    for (const kind of TYPED_KINDS) {
      const declared = CONTRACTS[kind].controlType as string;
      const conceals = CONTRACTS[kind].concealed === true;

      const id = `typed_${kind}`;
      await page.evaluate(({ api, mountId, k }) => {
        (window as never as Api)[api].mountFields(mountId, [{ name: "f", kind: k, label: "L" }] as never);
      }, { api: host.api, mountId: id, k: kind });
      await page.locator(`[data-form="${id}"]`).waitFor({ timeout: 5_000 });
      await page.waitForTimeout(200);

      // Type into it, because a control that masks does so for what is in it — and a field that
      // refuses what is typed would satisfy any reading of "hidden" by holding nothing.
      const box = page.locator(`[data-form="${id}"] input, [data-form="${id}"] textarea`).first();
      if (await box.count() > 0) await box.fill("aaaaaaaa").catch(() => undefined);
      await page.waitForTimeout(150);

      const drawn = await page.evaluate((selector) => {
        const control = document.querySelector(`${selector} input, ${selector} textarea`) as HTMLInputElement | null;
        if (control === null) return null;
        return {
          tag: control.tagName.toLowerCase(),
          type: control.getAttribute("type") ?? (control.tagName.toLowerCase() === "textarea" ? "textarea" : "text"),
          // Whether it holds anything, never what. Nothing below needs the characters, and a value a
          // kind declares hidden should not cross into a process that writes failure messages.
          holdsSomething: control.value.length > 0,
        };
      }, `[data-form="${id}"]`);

      await page.evaluate(({ api, mountId }) => {
        try { (window as never as Api)[api].dispose?.(mountId as never); } catch { /* nothing mounted */ }
      }, { api: host.api, mountId: id });

      if (drawn === null) { notDrawn.push(kind); continue; }
      if (drawn.type !== declared) {
        wrongControl.push(`${kind} declares the browser should draw a ${declared} control and got a ${drawn.type}`);
      }
      if (conceals && !MASKING.has(drawn.type)) {
        notConcealed.push(`${kind} declares what is typed into it is hidden and is drawn as a ${drawn.type}, which shows it`);
      }
    }

    // A run that drew nothing has nothing to judge, and would agree with any declaration.
    expect(
      notDrawn,
      `${host.name} drew no control at all for ${JSON.stringify(notDrawn)}, so what the catalogue says `
      + "about them was never compared with anything",
    ).toEqual([]);

    expect(
      notConcealed,
      `${host.name}: ${JSON.stringify(notConcealed)}. A field declaring concealment and drawn as an `
      + "ordinary box shows the characters to anybody standing behind the person filling it in, "
      + "offers them to form autofill rather than to a password manager, and puts them in a phone "
      + "keyboard's suggestion strip. Nothing on the page looks wrong to whoever built the form.",
    ).toEqual([]);

    expect(
      wrongControl,
      `${host.name}: ${JSON.stringify(wrongControl)}. Which control a browser is asked to draw decides `
      + "the keyboard a phone offers, what autofill proposes, and how the value is checked before it "
      + "is sent. The catalogue names one per kind and three kinds name three different ones, so a "
      + "renderer answering the same way for all of them has not read it.",
    ).toEqual([]);
  });
}
