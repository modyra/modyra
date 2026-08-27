/**
 * A role is a promise to assistive technology: it says what a thing is, and everything downstream —
 * which keys are expected, which properties are owed, what gets announced — follows from it. A
 * renderer that writes a role no vocabulary declares has made that promise alone, and nothing in the
 * suite knows the obligations it now carries.
 *
 * The declaration is spread across four doors, and which of them carries the weight was measured
 * rather than assumed — by removing each in turn and counting what the removal accuses:
 *
 *   parts[part].role                    remove it and 20 roles go undeclared. This one carries it.
 *   structure.nodes[].element           remove either alone and nothing changes; remove both and 16
 *   MDY_FORM_SHELL_STRUCTURE            go undeclared, all of them `status`. They overlap entirely.
 *   MDY_POPUP_OPENERS role / promises   remove it and nothing changes: it declares nothing today that
 *                                       another door does not already say.
 *
 * That is worth reading twice. `status` is declared **twice**, in two vocabularies, and neither knows
 * about the other; the openers door is currently redundant. Nine vocabularies with no index between
 * them is how a name comes to be declared in two places and a tool comes to read one of them.
 *
 * Perimeter:
 *
 *   state     the field at rest — a panel that is closed does not show the roles inside it
 *   read      the `role` attribute the renderer wrote, not the role the platform computes; an
 *             implicit role from a tag is the platform's and is not the renderer's to declare
 *
 * Claims under attack: ADP-001, A11Y-004.
 */
import { expect, test } from "@playwright/test";
import {
  MDY_FORM_SHELL_STRUCTURE, MDY_POPUP_OPENERS, MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS,
} from "@modyra/widgets";
import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;
type Contract = {
  parts: Record<string, { role?: string }>;
  structure: { nodes: { part: string; element?: string }[] };
};
const CONTRACTS = MDY_WIDGET_CONTRACTS as unknown as Record<string, Contract>;
const OPENERS = MDY_POPUP_OPENERS as unknown as Record<string, { role?: string | null; promises?: string | null }>;
const SHELL = MDY_FORM_SHELL_STRUCTURE as unknown as { nodes: { element?: string }[] };

/** Every name any door gives this kind that could be written as a role. */
const declaredFor = (kind: string): Set<string> => {
  const declared = new Set<string>();
  for (const node of SHELL.nodes) if (node.element) declared.add(node.element);
  for (const part of Object.values(CONTRACTS[kind].parts)) if (part.role) declared.add(part.role);
  for (const node of CONTRACTS[kind].structure.nodes) if (node.element) declared.add(node.element);
  const opener = OPENERS[kind];
  if (opener?.role) declared.add(opener.role);
  if (opener?.promises) declared.add(opener.promises);
  return declared;
};

test("a role a renderer writes and nobody declared", async ({ page }) => {
  test.setTimeout(600_000);

  /** kind → renderer → role written → the first element carrying it. */
  const written = new Map<string, Record<string, Record<string, string> | null>>();

  for (const host of HOSTS) {
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    for (const kind of MDY_WIDGET_KINDS) {
      const mountId = `role-${kind}`;
      await page.evaluate(
        ({ door, id, k }) => (window as never as Api)[door].mountFields(id, [{
          name: "campo", kind: k, label: "Etichetta",
          options: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
        }] as never),
        { door: host.api, id: mountId, k: kind },
      );
      await page.locator(`[data-form="${mountId}"]`).waitFor({ timeout: 5_000 }).catch(() => undefined);

      const roles = await page.evaluate(
        ({ id, k }) => {
          const form = document.querySelector(`[data-form="${id}"]`);
          const root = (form?.querySelector(`.mdy-renderer--${k}`) ?? form) as HTMLElement | null;
          if (root === null) return null;
          const found: Record<string, string> = {};
          // The root is included on purpose: `querySelectorAll` looks only at descendants, and a role
          // written on the field's own outermost element is the one most likely to be wrong.
          for (const element of [root, ...root.querySelectorAll<HTMLElement>("[role]")]) {
            const role = element.getAttribute("role");
            if (role !== null && !(role in found)) {
              found[role] = `${element.tagName.toLowerCase()}.${String(element.className).split(/\s+/)[0]}`;
            }
          }
          return found;
        },
        { id: mountId, k: kind },
      );

      if (!written.has(kind)) written.set(kind, {});
      written.get(kind)![host.name] = roles;
    }
  }

  // The premise, both halves: a field that was never drawn writes no roles, and so does a field that
  // was drawn perfectly. Only one of those is worth a green.
  const undrawn = [...written.entries()]
    .flatMap(([kind, byHost]) => HOSTS.filter((h) => byHost[h.name] === null).map((h) => `${kind} in ${h.name}`));
  expect(undrawn, "these were never drawn, so no role was read for them").toEqual([]);

  const anyRole = [...written.values()].some((byHost) => Object.values(byHost).some((roles) => Object.keys(roles ?? {}).length > 0));
  expect(anyRole, "no renderer wrote a single role, so this is reading a page with no markup in it").toBe(true);

  const undeclared = [...written.entries()].flatMap(([kind, byHost]) => {
    const declared = declaredFor(kind);
    return HOSTS.flatMap((host) => Object.entries(byHost[host.name] ?? {})
      .filter(([role]) => !declared.has(role))
      .map(([role, where]) => `${kind} in ${host.name}: writes role="${role}" on ${where}`));
  });

  expect(
    undeclared,
    `${undeclared.length} role(s) are written by a renderer and declared by nobody:\n${undeclared.join("\n")}\n\n` +
      "A role brings obligations with it — the keys it implies, the properties it owes, what a screen " +
      "reader will say it is. Undeclared, those obligations belong to no contract and no check, and " +
      "the two renderers that did not write it are not wrong.",
  ).toEqual([]);
});
