/**
 * Whether the half of the anatomy that only exists while a thing is open is ever built.
 *
 * A kind's parts split in two. Most are there whenever the field is on the page; some exist only
 * while an overlay is open, and the contract is explicit that this is not a weaker requirement but a
 * differently-timed one: *a closed widget is not required to render any of them — what both must do
 * is render them when open.*
 *
 * **The first half is checked and the second was not.** `a-part-the-contract-requires` subtracts the
 * overlay-only parts and mounts every kind closed, which is right for the question it asks. Nothing
 * asked the other half. So eight parts that the contract marks required, across six kinds, were owed
 * by every renderer and demanded of none:
 *
 *     select        options
 *     multiselect   options · option · optionLabel
 *     datepicker    calendar
 *     daterange     calendar
 *     timepicker    container
 *     colors        presets
 *
 * **An exception carries its own condition, and a check evaluates it rather than applying it.** The
 * exemption that hides these is correct — while the overlay is closed. Applied without asking whether
 * the overlay is closed *now*, it hides everything inside an open one, which is where a good share of
 * this suite's findings have lived: a reading position that would not move, an option named by the
 * wrong attribute, a list that answered only one way in. An exception applied instead of evaluated is
 * the hardest kind to see, because the source is right and the mistake is in the verb.
 *
 * **Available, not present.** The contract permits a renderer to build its overlay eagerly and hide
 * it — *one that mounts lazily is not breaking the contract, and one that mounts eagerly is not
 * breaking it either*. So asking whether the element is in the document answers a question nobody
 * asked: every renderer here builds all eight while shut. What is owed is that the parts are **there
 * to be used** once it is open, which is a box and not a node.
 *
 * **The condition is read in both directions.** Shut, these parts have no box; open, they have one.
 * The first half is not a rule imposed on renderers — it is this file checking that the exemption it
 * is about is real for this kind, because a part with a box while shut was never excused and its box
 * when open proves nothing.
 *
 * **A kind whose overlay is the platform's is not judged.** Where a renderer hands the list to the
 * operating system there is no markup of ours to find and no expanded state to read; the file says so
 * for that kind rather than reporting parts it could never have seen.
 *
 * The opener is read from the catalogue rather than guessed: the part that opens a kind's overlay is
 * declared, and a kind that stops declaring one is reported as unreachable instead of failing.
 *
 * Claims under attack: UI-005.
 */

import { expect, test } from "@playwright/test";
import { MDY_POPUP_OPENERS, MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS, overlayOnlyParts } from "@modyra/widgets";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;
type Node = { part: string; optional?: boolean };

const CONTRACTS = MDY_WIDGET_CONTRACTS as unknown as Record<string, {
  parts: Record<string, { classes: string[] }>;
  structure: { nodes: Node[] };
}>;

/** The parts a kind owes only while its overlay is open. */
const owedWhenOpen = (kind: string): string[] => {
  const overlay = new Set(overlayOnlyParts(kind as never));
  return (CONTRACTS[kind]?.structure.nodes ?? [])
    .filter((node) => node.optional === false && overlay.has(node.part))
    .map((node) => node.part);
};

const KINDS = MDY_WIDGET_KINDS.filter((kind) => owedWhenOpen(kind).length > 0);
const needsOptions = (kind: string) => /select|radio|segmented/.test(kind);

for (const host of HOSTS) {
  test(`the parts a kind owes only while open are built when it is, ${host.name}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1_200, height: 800 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    // Without kinds that owe something only when open, this file is about nothing — and it would be
    // green for that reason rather than for anything a renderer did.
    expect(KINDS.length, "no kind declares a required part that lives only inside an overlay").toBeGreaterThan(0);

    const missingWhenOpen: string[] = [];
    const presentWhenClosed: string[] = [];
    const unreachable: string[] = [];
    /** Kinds whose overlay belongs to the operating system, and so has no markup here to judge. */
    const platform: string[] = [];

    for (const kind of KINDS) {
      const owed = owedWhenOpen(kind);
      const opener = (MDY_POPUP_OPENERS as Record<string, { opener?: string } | undefined>)[kind]?.opener;
      if (opener === undefined) { unreachable.push(`${kind}: the catalogue names no opener`); continue; }
      const openerClass = CONTRACTS[kind].parts[opener]?.classes?.[0];
      if (openerClass === undefined) { unreachable.push(`${kind}: ${opener} has no declared class`); continue; }

      const id = `open_${kind}`;
      await page.evaluate(({ api, mountId, k, options }) => {
        const field: Record<string, unknown> = { name: "f", kind: k, label: `L ${k}` };
        if (/select|radio|segmented/.test(k)) field.options = options;
        (window as never as Api)[api].mountFields(mountId, [field] as never);
      }, {
        api: host.api, mountId: id, k: kind,
        options: needsOptions(kind) ? [{ value: "a", label: "A" }, { value: "b", label: "B" }] : [],
      });
      await page.locator(`[data-form="${id}"]`).waitFor({ timeout: 5_000 });
      await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
      await page.waitForTimeout(300);

      /**
       * Whether each owed part is there to be used — a box, not a node. An overlay may be drawn
       * outside the field, so the whole document is searched, and a renderer that builds its overlay
       * eagerly and hides it is answering correctly while shut.
       */
      const built = () => page.evaluate(({ mountId, wanted }) => {
        const out: Record<string, boolean> = {};
        for (const [part, classes] of Object.entries(wanted as Record<string, string[]>)) {
          const selector = classes.map((one) => `.${one}`).join("");
          const found = [
            ...Array.from(document.querySelectorAll(`[data-form="${mountId}"] ${selector}`)),
            ...Array.from(document.querySelectorAll(selector)),
          ] as HTMLElement[];
          out[part] = found.some((one) => {
            const box = one.getBoundingClientRect();
            return box.width >= 1 && box.height >= 1;
          });
        }
        return out;
      }, { mountId: id, wanted: Object.fromEntries(owed.map((part) => [part, CONTRACTS[kind].parts[part].classes])) });

      // The condition, read while it still holds: closed, these parts are excused, so they must be
      // absent. A renderer that draws them always makes the assertion below meaningless.
      const whileClosed = await built();
      for (const [part, there] of Object.entries(whileClosed)) {
        if (there) presentWhenClosed.push(`${kind}.${part}`);
      }

      const toggle = page.locator(`[data-form="${id}"] .${openerClass}`).first();
      if (await toggle.count() === 0) { unreachable.push(`${kind}: ${opener} was not drawn`); continue; }
      await toggle.click({ timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(500);

      // The condition no longer holds, so the exemption lifts and what it excused is owed.
      const opened = await page.evaluate(({ mountId }) =>
        document.querySelector(`[data-form="${mountId}"] [aria-expanded]`)?.getAttribute("aria-expanded") ?? "(none)",
        { mountId: id });
      // A kind that reports no expanded state at all has handed its list to the platform: there is
      // nothing of ours to find, and saying so is the honest answer rather than reporting eight parts
      // this file could never have seen.
      if (opened === "(none)") { platform.push(kind); continue; }
      if (opened !== "true") { unreachable.push(`${kind}: pressing ${opener} left it ${opened}`); continue; }

      const whileOpen = await built();
      for (const [part, there] of Object.entries(whileOpen)) {
        if (!there) missingWhenOpen.push(`${kind}.${part}`);
      }

      await page.evaluate(({ api, mountId }) => {
        (window as never as Api)[api].dispose?.(mountId as never);
      }, { api: host.api, mountId: id });
    }

    expect(
      unreachable,
      `${host.name}: ${unreachable.join("; ")}. These kinds were not judged either way, and a file `
      + "that cannot open a thing has nothing to say about what the thing contains",
    ).toEqual([]);

    expect(
      presentWhenClosed,
      `${host.name} gives ${presentWhenClosed.join(", ")} a box while the overlay is shut, so these `
      + "parts were never excused for this kind and their box when open says nothing about opening. "
      + "This is a fact about the exemption rather than a rule for the renderer.",
    ).toEqual([]);

    // Every kind judged, or named as one the platform owns. A run where all of them turned out to be
    // the platform's would compare nothing and this says so instead of passing.
    expect(
      platform.length,
      `${host.name}: every kind here hands its overlay to the platform (${platform.join(", ")}), so `
      + "there was nothing of ours to look inside",
    ).toBeLessThan(KINDS.length);

    expect(
      missingWhenOpen,
      `${host.name} does not build ${missingWhenOpen.join(", ")} with the overlay open. The contract `
      + "marks these parts required and excuses them only while the thing is shut — what a renderer "
      + "owes when it is open is all of them. Nothing had asked: the file that checks required parts "
      + "subtracts these and mounts every kind closed, so this half of the anatomy was owed by "
      + "everyone and demanded of no one.",
    ).toEqual([]);
  });
}
