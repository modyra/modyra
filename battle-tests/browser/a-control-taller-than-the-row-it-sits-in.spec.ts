/**
 * Every control in a form is one row high, and stays that height whatever it is holding.
 *
 * This is a layout rule the project treats as mandatory rather than as a preference: a form is read
 * down its left edge, and a control that stands taller than its neighbours breaks the line a person
 * follows. It is asserted here for the same reason the theme class contract is — a rule nobody
 * measures is a rule that drifts one stylesheet at a time.
 *
 * Two properties, and the second is the one the multiselect puts under pressure:
 *
 *   1. within one renderer and one stylesheet, every field kind draws a box of the same height;
 *   2. a multiselect's height does not depend on how many chips it holds.
 *
 * The second is what makes the strip scroll rather than wrap. A strip with nowhere to put an
 * overflowing chip puts it on a second line, and the control grows — so "the strip scrolls" and "the
 * control keeps its height" are the same repair seen from two sides, and this spec is the side a
 * person actually sees.
 *
 * **Every stylesheet is measured, not just the host's own.** The host loads `modyra-default.css`, and
 * on that sheet all the heights agree — the defect lives in one theme, so a spec that read only the
 * default would be green forever while the theme it broke shipped. That the swap really takes effect
 * is checked before anything is measured: the sheets disagree about `border-radius` and about
 * `--mdy-sys-color-primary`, and a reading taken while the old sheet was still applied would be an
 * artefact rather than evidence.
 *
 * Claims under attack: UI-009, UI-011.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
  { name: "angular", page: "/angular.html", ready: "battleAngularReady", api: "battleAngular" },
];

const SHEETS = ["./modyra.css", "./modyra-modern.css", "./modyra-material.css", "./modyra-ios.css", "./modyra-ionic.css"];

/** The kinds a form puts in a column together. Each names its own box; they need not share a class. */
const KINDS = ["text", "number", "select", "multiselect"] as const;
const wrapperClassOf = (kind: string) => {
  const parts = MDY_WIDGET_CONTRACTS[kind as keyof typeof MDY_WIDGET_CONTRACTS]?.parts as
    | Record<string, { classes: string[] }>
    | undefined;
  return parts?.inputWrapper?.classes[0] ?? "mdy-input-wrapper";
};

const OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  value: `v${index}`,
  label: `Opzione lunga numero ${index}`,
}));

/** Swaps the sheet and refuses to measure until the new one is the one in force. */
async function useSheet(page: import("@playwright/test").Page, href: string) {
  const applied = await page.evaluate(async (href) => {
    const link = document.querySelector("link[rel=stylesheet]") as HTMLLinkElement | null;
    if (link === null) return null;
    link.href = href;
    for (let waited = 0; waited < 3_000; waited += 100) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (link.sheet !== null) break;
    }
    const root = getComputedStyle(document.documentElement);
    return {
      loaded: link.sheet !== null,
      // A fingerprint rather than a rule count: the sheets are full standalone builds and disagree
      // about these two, so a stale sheet is visible instead of being assumed away.
      primary: root.getPropertyValue("--mdy-sys-color-primary").trim(),
    };
  }, href);
  expect(applied, "the host page carries no stylesheet link to swap").not.toBeNull();
  expect(applied!.loaded, `${href} did not load, so any height read here belongs to the previous sheet`).toBe(true);
  return applied!;
}

for (const host of HOSTS) {
  const mount = async (page: import("@playwright/test").Page, id: string, chosen: number) => {
    await page.evaluate(({ api, id, options, chosen, kinds }) => {
      const field = (kind: string) => {
        const base: Record<string, unknown> = { name: kind, kind, label: kind };
        if (kind === "select" || kind === "multiselect") base.options = options;
        if (kind === "multiselect") base.initialValue = options.slice(0, chosen).map((o: { value: string }) => o.value);
        return base;
      };
      (window as never as Record<string, Record<string, (...a: never[]) => unknown>>)[api]
        .mountFields(id, kinds.map(field) as never);
    }, { api: host.api, id, options: OPTIONS, chosen, kinds: [...KINDS] });
    await page.waitForTimeout(400);
    return page.evaluate(({ id, wanted }) => {
      const root = document.querySelector(`[data-form="${id}"]`);
      if (root === null) return null;
      const read: Record<string, number | null> = {};
      for (const [kind, className] of Object.entries(wanted)) {
        const own = root.querySelector(`.${className}`);
        const shared = root.querySelector(".mdy-input-wrapper");
        const box = own ?? shared;
        read[kind] = box === null ? null : Math.round(box.getBoundingClientRect().height);
      }
      return read;
    }, { id, wanted: Object.fromEntries(KINDS.map((kind) => [kind, wrapperClassOf(kind)])) });
  };

  test(`every kind draws a box of the same height, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const disagreeing: string[] = [];
    const fingerprints = new Set<string>();
    for (const sheet of SHEETS) {
      const applied = await useSheet(page, sheet);
      fingerprints.add(`${sheet}:${applied.primary}`);
      const read = await mount(page, `same_${SHEETS.indexOf(sheet)}`, 0);
      expect(read, `${host.name} mounted nothing under ${sheet}`).not.toBeNull();

      const drawn = Object.entries(read!).filter(([, height]) => height !== null) as [string, number][];
      // The premise: the kinds were drawn at all. A kind that renders no box is a different defect
      // and must not be read as a height that happens to agree.
      const missing = Object.entries(read!).filter(([, height]) => height === null).map(([kind]) => kind);
      expect(missing, `${host.name} drew no box for ${missing.join(", ")} under ${sheet}`).toEqual([]);

      const distinct = new Set(drawn.map(([, height]) => height));
      if (distinct.size > 1) {
        disagreeing.push(`${sheet}  ${drawn.map(([kind, height]) => `${kind} ${height}px`).join(" · ")}`);
      }
    }

    expect(
      fingerprints.size,
      "the sheets are indistinguishable by their own tokens, so the swap did not take and every " +
        "reading above came from one stylesheet",
    ).toBeGreaterThan(1);

    expect(
      disagreeing,
      `a form's controls are not one row high — a person reading down the column meets a step:\n  ${disagreeing.join("\n  ")}`,
    ).toEqual([]);
  });

  test(`a multiselect keeps its height whatever it holds, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const growing: string[] = [];
    for (const sheet of SHEETS) {
      await useSheet(page, sheet);
      const at: Record<number, number | null> = {};
      for (const chosen of [0, 2, 12]) {
        const read = await mount(page, `grow_${SHEETS.indexOf(sheet)}_${chosen}`, chosen);
        at[chosen] = read?.multiselect ?? null;
      }
      const drawn = Object.values(at).filter((height) => height !== null) as number[];
      expect(drawn.length, `${host.name} drew no multiselect under ${sheet}`).toBe(3);
      if (new Set(drawn).size > 1) {
        growing.push(`${sheet}  empty ${at[0]}px · two ${at[2]}px · twelve ${at[12]}px`);
      }
    }

    expect(
      growing,
      `the control grows with what is put in it, so choosing pushes the rest of the form down:\n  ` +
        `${growing.join("\n  ")}\nA strip with nowhere to put an overflowing chip wraps it onto a ` +
        `second line; the repair is the same one that makes the strip scroll`,
    ).toEqual([]);
  });
}
