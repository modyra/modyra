import { expect, test } from "@playwright/test";

/**
 * A number field's two steppers are each pressed where each is drawn, in every theme of the demo.
 * Stacked in a field shorter than two targets they overlap, and the centre of Increase belongs to
 * Decrease — so the check is the press point, not the drawn size: `elementFromPoint` at each button's
 * centre must be that button, and the two boxes must not intersect. Each keeps WCAG 2.5.8's 24px.
 *
 * The steppers are found through the contract's spinner, so a renderer that draws them in a box the
 * contract does not name fails here rather than escaping the shared geometry unnoticed.
 */
const THEMES = ["modyra-default", "modyra-modern", "modyra-material", "modyra-ios", "modyra-ionic", "modyra-foundation"];

for (const theme of THEMES) {
  test(`${theme}: each stepper is pressed where it is drawn`, async ({ page }) => {
    await page.goto("/");
    await page.locator(".mdy-spin-btn-up").first().waitFor();
    await page.evaluate(async (name) => {
      const link = document.getElementById("mdy-theme-link") as HTMLLinkElement;
      const href = `styles/${name}.css`;
      if (link.getAttribute("href") === href) return;
      await new Promise<void>((resolve) => {
        link.addEventListener("load", () => resolve(), { once: true });
        link.addEventListener("error", () => resolve(), { once: true });
        link.setAttribute("href", href);
      });
    }, theme);
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => done(null))));

    const unhoused = await page.locator(".mdy-spin-btn").evaluateAll((buttons) =>
      buttons.filter((b) => !b.parentElement?.classList.contains("mdy-number-spinner")).length);
    expect(unhoused).toBe(0);

    const spinners = await page.locator(".mdy-number-spinner").evaluateAll((els) => els
      .filter((el) => el.getBoundingClientRect().width > 0)
      .map((el) => {
        el.scrollIntoView({ block: "center" });
        const input = el.querySelector("input");
        const name = input?.getAttribute("aria-label") ?? input?.id ?? "";
        const [up, down] = [".mdy-spin-btn-up", ".mdy-spin-btn-down"].map((s) => el.querySelector(s)!);
        const [u, d] = [up, down].map((b) => b.getBoundingClientRect());
        const hits = (b: Element, r: DOMRect) => b.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        const overlap = Math.max(0, Math.min(u.right, d.right) - Math.max(u.left, d.left))
          * Math.max(0, Math.min(u.bottom, d.bottom) - Math.max(u.top, d.top));
        return { name, up: hits(up, u), down: hits(down, d), overlap, smallest: Math.min(u.width, u.height, d.width, d.height) };
      }));

    expect(spinners.length).toBeGreaterThan(0);
    for (const s of spinners) {
      expect(s, s.name).toEqual({ name: s.name, up: true, down: true, overlap: 0, smallest: expect.any(Number) });
      expect(s.smallest, s.name).toBeGreaterThanOrEqual(24);
    }
  });
}
