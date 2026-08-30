/**
 * An ARIA attribute is a promise made to a screen reader, and the same document should make the same
 * promises whoever drew it. It does not.
 *
 * Nineteen ARIA attributes are in play across the three renderers. **Seven of them are declared** —
 * `MDY_WIDGET_RELATIONS` names the ones that point at another part, and the state vocabularies name
 * `aria-disabled`, `aria-invalid`, `aria-readonly`, `aria-expanded`. The other twelve are written by
 * renderers and named by nothing: `aria-live`, `aria-modal`, `aria-haspopup`, `aria-valuenow` and the
 * rest carry obligations — a live region has a politeness and an atomicity, a spinbutton owes a value,
 * a range and a text — and no check asks for any of them.
 *
 * So this asserts the thing that holds without a declaration: **the three agree**. A promise made in
 * one adapter and not another is a person being told something on one page and not on the identical
 * page next to it, and no reading of the contract says which one is right — which is exactly why it is
 * the contract that owes the answer.
 *
 * **Read in the state each part lives in.** A renderer that builds its panel and hides it carries the
 * panel's attributes at rest; one that builds the panel when it opens carries none of them until it
 * does. Swept at rest alone, that difference reads as one renderer promising what another withholds —
 * two thirds of what this once reported was that, and none of it was a promise. So each kind is read
 * closed and again open, and the panel is followed by the link the opener declares rather than by
 * document containment, because a panel rendered elsewhere is still the field's.
 *
 * **And in the state where a refusal exists.** The error list is where `aria-live` lives, and a field
 * with nothing to say has no error list: swept silent, one renderer's container is there because it
 * builds it and hides it, and the other two have not built theirs. That was a third of what this
 * reported. The field is made to speak — a value typed and taken away, or a submission refused —
 * before the last reading.
 *
 * **`aria-hidden` is not a promise and is left out.** Every attribute here says something to a reader
 * except that one, which says the opposite: this element is not for you. Measured, it sits on an icon
 * and on the `×` of a clear button in two renderers and on nothing in the third — so what it tracks
 * is whether a renderer draws a decorative mark at all, which is a drawing decision the contract does
 * not make. Counted as a promise, six kinds read as a divergence in what they tell a reader when the
 * difference is what they draw.
 *
 * Read as *which attributes are written at all* on a kind, not their values: a value differs for
 * honest reasons, a promise being absent does not.
 *
 * The dominant shape is not subtle. `aria-live` appears on every kind in one renderer and on none in
 * the other two.
 *
 * Claims under attack: ADP-001, A11Y-004.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { MDY_POPUP_OPENERS, MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS, partClasses, variantOf } from "@modyra/widgets";
import { HOSTS, madeToSpeak } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

/**
 * Every shape a kind declares, with the classes that identify each one's required parts.
 *
 * A variant that requires nothing cannot be recognised by what is on the page — it is what is left
 * when no other shape's parts are there.
 */
const variantParts = (kind: string): Array<[string, string[][]]> =>
  Object.entries((MDY_WIDGET_CONTRACTS[kind as never] as { variants?: Record<string, { required?: string[] }> }).variants ?? {})
    .map(([name, variant]) => [name, (variant.required ?? []).map((part) => [...partClasses(kind, part)])]);

/**
 * What the sweep mounts: one field per kind, and one per shape for a kind that declares more than one.
 *
 * The property that picks a shape is the document's own word for it, and `variantOf` is what turns
 * that word into a shape — so what each mount asks for is asked of the contract rather than assumed,
 * and a renderer that draws the other shape anyway is the finding rather than the mount being wrong.
 */
const SUBJECTS: Array<{ kind: string; name: string; extra: Record<string, unknown> }> =
  MDY_WIDGET_KINDS.flatMap((kind) =>
    kind === "select"
      ? [{ kind, name: "select asked plainly", extra: { searchable: false } },
         { kind, name: "select asked searchable", extra: { searchable: true } }]
      : [{ kind, name: kind, extra: {} }]);

/**
 * A difference a decision record argues is not a difference, read from the record that argues it.
 *
 * An exemption held in a test is an exemption nobody can find and nobody can overturn: the reasoning
 * lives in one place and the silence it buys lives in another, and the two drift. So each entry names
 * the record, and the sentence in it that makes the argument. The row is dropped only while that
 * record is on disk, still `Accepted`, and still saying that sentence — a record superseded, retired
 * or rewritten brings the row back, which is the point.
 */
const DISMISSED: Array<{ row: string; record: string; argues: string }> = [
  {
    row: "file: aria-label",
    record: "0177-what-the-contract-declines-to-say.md",
    argues: "Naming a control by the caption's reference or by its words is one answer, not two",
  },
];

/** The rows a live record excuses, and why each other one is not excused. */
const excused = (): { rows: Set<string>; lapsed: string[] } => {
  const rows = new Set<string>();
  const lapsed: string[] = [];
  for (const one of DISMISSED) {
    const path = join(process.cwd(), "docs", "architecture", one.record);
    const text = existsSync(path) ? readFileSync(path, "utf8") : null;
    if (text === null) { lapsed.push(`${one.row}: ${one.record} is not on disk`); continue; }
    if (!/^Status:\s*Accepted\s*$/m.test(text)) { lapsed.push(`${one.row}: ${one.record} is no longer Accepted`); continue; }
    if (!text.includes(one.argues)) { lapsed.push(`${one.row}: ${one.record} no longer argues it`); continue; }
    rows.add(one.row);
  }
  return { rows, lapsed };
};

/** What each subject's document asks for, in the contract's own words. `undefined` for one anatomy. */
const asksFor = (kind: string, extra: Record<string, unknown>): string | undefined =>
  variantOf(kind as never, extra as never);


test("an aria promise that depends on the adapter", async ({ page }) => {
  test.setTimeout(600_000);

  /** kind → renderer → the ARIA attributes written anywhere in the field. */

  const written = new Map<string, Record<string, string[]>>();
  const shapes = new Map<string, Record<string, string>>();
  let seen = 0;

  for (const host of HOSTS) {
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    for (const subject of SUBJECTS) {
      const { kind, extra, name: subjectName } = subject;
      const mountId = `aria-${subjectName}`;
      await page.evaluate(
        ({ door, id, k, extra }) => (window as never as Api)[door].mountFields(id, [{
          name: "campo", kind: k, label: "Etichetta", validators: { required: true },
          options: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
          ...extra,
        }] as never),
        { door: host.api, id: mountId, k: kind, extra },
      );
      await page.locator(`[data-form="${mountId}"]`).waitFor({ timeout: 5_000 }).catch(() => undefined);

      const sweep = () => page.evaluate(({ id }) => {
        const root = document.querySelector(`[data-form="${id}"]`) as HTMLElement | null;
        if (root === null) return [];
        const names = new Set<string>();
        const take = (where: Element) => {
          for (const element of where.querySelectorAll("*")) {
            for (const name of element.getAttributeNames()) {
            if (name === "aria-hidden") continue;
            // The attribute *and* where it landed. A promise one renderer makes and another does not
            // is one finding on the control and a different one on an option inside it: the same
            // attribute on the group is the caption doing its job and on each option is the caption
            // taking the option's own name away, and a row that says only the attribute sends a
            // reader to look at the wrong element.
            if (name.startsWith("aria-")) {
              const part = [...element.classList].find((one) => one.startsWith("mdy-"))
                ?? `${element.tagName.toLowerCase()}${element.getAttribute("role") === null ? "" : `[${element.getAttribute("role")}]`}`;
              names.add(`${name} on ${part}`);
            }
          }
          }
        };
        take(root);
        // The panel wherever the renderer put it, named by the link rather than found by containment.
        for (const opener of root.querySelectorAll("[aria-controls]")) {
          const panel = document.getElementById(opener.getAttribute("aria-controls") ?? "");
          if (panel !== null) take(panel);
        }
        return [...names];
      }, { id: mountId });

      const atRest = await sweep();
      // Opened, because the parts that carry half of these attributes do not exist until it is.
      // A kind with no panel names no opener, and asking for the classes of a part it does not have
      // raises rather than answering — so the question is only put where there is one.
      const opener = (MDY_POPUP_OPENERS as unknown as Record<string, { opener?: string } | undefined>)[kind]?.opener;
      const openerClasses = opener === undefined
        ? []
        : (partClasses(kind, opener) as string[] | undefined) ?? [];
      if (openerClasses.length > 0) {
        await page.locator(`[data-form="${mountId}"] ${openerClasses.map((one) => `.${one}`).join("")}`)
          .first().click({ timeout: 3_000 }).catch(() => undefined);
        await page.waitForTimeout(350);
      }
      const opened = await sweep();
      await page.keyboard.press("Escape").catch(() => undefined);
      await page.waitForTimeout(120);
      await madeToSpeak(page, `[data-form="${mountId}"]`, host.api);
      const speaking = await sweep();
      const found = [...new Set([...atRest, ...opened, ...speaking])];

      // Which of the shapes this kind declares was actually drawn, read from the parts a variant
      // says it requires. Two renderers handed the same document can draw different shapes, and
      // comparing the ARIA of one against the ARIA of the other reports the shape as an attribute
      // defect — six rows for one divergence, none of them the thing that is wrong.
      const shape = await page.evaluate(({ id, variants }) => {
        const root = document.querySelector(`[data-form="${id}"]`) as HTMLElement | null;
        if (root === null || variants.length === 0) return null;
        // A shape the platform draws is read off the platform's own element, because the required
        // parts do not separate these two: a `<select>` is styled with the same arrow as a custom
        // trigger, so the part is there in both and tells them apart in neither.
        if (variants.some(([name]) => name === "native")) {
          return root.querySelector("select") === null ? "custom" : "native";
        }

        const drawn = variants.filter(([, required]) =>
          required.length > 0 && required.every((classes) => classes.some((one) => root.querySelector(`.${one}`) !== null)));
        return drawn.length === 1 ? drawn[0][0] : `${drawn.length} of them at once`;
      }, { id: mountId, variants: variantParts(kind) });

      seen += found.length;
      if (!written.has(subjectName)) written.set(subjectName, {});
      written.get(subjectName)![host.name] = found;
      if (shape !== null) {
        if (!shapes.has(subjectName)) shapes.set(subjectName, {});
        shapes.get(subjectName)![host.name] = shape;
      }
    }
  }

  // The premise: a page that wrote no ARIA at all has three renderers agreeing perfectly about nothing.
  expect(seen, "no renderer wrote a single ARIA attribute, so this compared nothing").toBeGreaterThan(30);

  // A shape disagreement first: renderers handed one document that drew different anatomies do not
  // have an ARIA defect between them, they have this one, and every attribute row below it is a
  // symptom. Reported on its own so the cause is not read six times as six defects.
  const shapeSplits = [...shapes.entries()]
    .filter(([, byHost]) => new Set(HOSTS.map((host) => byHost[host.name]).filter((one) => one !== undefined)).size > 1)
    .map(([subject, byHost]) => {
      const asked = SUBJECTS.find((one) => one.name === subject);
      return `${subject}: asked for ${asksFor(asked?.kind ?? "", asked?.extra ?? {}) ?? "its one shape"}, `
        + `drawn as ${HOSTS.map((host) => `${byHost[host.name] ?? "nothing"} by ${host.name}`).join(", ")}`;
    });

  const disagreements = [...shapeSplits, ...[...written.entries()].flatMap(([kind, byHost]) => {
    const everywhere = new Set(HOSTS.flatMap((host) => byHost[host.name] ?? []));
    return [...everywhere]
      .filter((name) => HOSTS.some((host) => !(byHost[host.name] ?? []).includes(name)))
      .sort()
      .map((name) => `${kind}: ${name} written by ${HOSTS.filter((host) => (byHost[host.name] ?? []).includes(name)).map((host) => host.name).join(" and ")}`);
  })];

  const { rows: dismissed, lapsed } = excused();
  const standing = disagreements.filter((one) => ![...dismissed].some((row) => one.startsWith(row)));

  // A record that stopped arguing its exemption is louder than the row it was excusing: the silence
  // outlives the reasoning otherwise, and nobody reading the sweep would know why the row is absent.
  expect(
    lapsed,
    `${lapsed.length} dismissal(s) name a record that no longer makes their case:\n${lapsed.join("\n")}`,
  ).toEqual([]);

  expect(
    standing,
    `${standing.length} ARIA promise(s) are made by some renderers and not others:\n${standing.join("\n")}\n\n` +
      `${dismissed.size > 0 ? `Not counted, argued by a record: ${[...dismissed].join(", ")}.\n\n` : ""}` +
      "A shape row above an attribute row is the cause of it: renderers that drew different anatomies " +
      "from one document have no ARIA defect between them until they agree on what they are drawing. " +
      "Which shape a document asks for is not published — the catalogue names the shapes and nothing " +
      "at runtime says what chooses between them — so the mount names the property and a renderer " +
      "that draws the other shape anyway is what this reports.\n\n" +
      "The same document should say the same things to a screen reader whoever drew it. Which answer " +
      "is right is not in the contract — seven of the nineteen attributes in play are declared at all — " +
      "so this is a declaration owed, not a renderer to blame.",
  ).toEqual([]);
});
