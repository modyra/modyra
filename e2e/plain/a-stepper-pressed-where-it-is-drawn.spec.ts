import { expect, test } from "@playwright/test";

/**
 * A number field's two steppers are each pressed where each is drawn, in every theme. Stacked in a
 * field shorter than two targets they overlap, and the centre of Increase belongs to Decrease — so
 * the check is the press point, not the drawn size: `elementFromPoint` at each button's centre must
 * be that button, and the two boxes must not intersect. Each keeps WCAG 2.5.8's 24px. The value
 * stands clear of them: the input's content box ends before the nearer stepper begins, stacked or
 * side by side, so a long value is never drawn under a control. "Ends" is the inline end, so in a
 * right-to-left document the content box begins at or after the right edge of the steppers.
 */
const THEMES = ["modyra-modern", "modyra-default", "modyra-material", "modyra-ios", "modyra-ionic", "modyra-foundation"];

for (const theme of THEMES) for (const dir of ["ltr", "rtl"] as const) {
  test(`${theme} ${dir}: each stepper is pressed where it is drawn, clear of the value`, async ({ page }) => {
    await page.goto("/lab.html#orders");
    await page.locator(".mdy-number-spinner").first().waitFor();
    await page.evaluate((name) => new Promise<void>((done) => {
      const link = document.getElementById("modyra-theme") as HTMLLinkElement;
      if (link.href.endsWith(`/${name}.css`)) return done();
      link.onload = () => done();
      link.href = `./themes/${name}.css`;
    }), theme);
    await page.evaluate((d) => { document.documentElement.dir = d; }, dir);

    const spinners = await page.locator(".mdy-number-spinner").evaluateAll((els) => els
      .filter((el) => el.getBoundingClientRect().width > 0)
      .map((el) => {
        el.scrollIntoView({ block: "center" });
        const name = el.querySelector("input")?.getAttribute("aria-label") ?? "";
        const [up, down] = [".mdy-spin-btn-up", ".mdy-spin-btn-down"].map((s) => el.querySelector(s)!);
        const [u, d] = [up, down].map((b) => b.getBoundingClientRect());
        const hits = (b: Element, r: DOMRect) => b.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        const overlap = Math.max(0, Math.min(u.right, d.right) - Math.max(u.left, d.left))
          * Math.max(0, Math.min(u.bottom, d.bottom) - Math.max(u.top, d.top));
        const input = el.querySelector("input")!;
        const box = input.getBoundingClientRect(), style = getComputedStyle(input);
        const clear = style.direction === "rtl"
          ? box.left + parseFloat(style.paddingLeft) >= Math.max(u.right, d.right) - 0.5
          : box.right - parseFloat(style.paddingRight) <= Math.min(u.left, d.left) + 0.5;
        return { name, up: hits(up, u), down: hits(down, d), overlap, clear, smallest: Math.min(u.width, u.height, d.width, d.height) };
      }));

    expect(spinners.length).toBeGreaterThan(0);
    for (const s of spinners) {
      expect(s, s.name).toEqual({ name: s.name, up: true, down: true, overlap: 0, clear: true, smallest: expect.any(Number) });
      expect(s.smallest, s.name).toBeGreaterThanOrEqual(24);
    }
  });
}
