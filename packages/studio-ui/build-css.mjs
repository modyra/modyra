/**
 * Ships the Modyra theme underneath Studio's own chrome.
 *
 * The theme is entirely inside `@layer mdy.*`, and unlayered CSS beats layered CSS regardless
 * of specificity. So concatenating it *before* studio.css means it can only style what Studio
 * does not already style — the widget parts @modyra/plain emits (mdy-switch, mdy-label,
 * mdy-input-wrapper, …) get the shipped look, and no Studio rule is overridden by it.
 *
 * The theme is modyra-modern.css, not modyra.css. modyra.css resolves every value through a
 * `--mdy-sys-*` primitive that only modyra-base.css declares — loaded alone it applied its
 * structure (flex, a 56px min-height) with no colour at all, which is what forced the
 * `.plain-canvas-form .mdy-input-wrapper` stopgaps studio.css used to carry. It also styles the
 * control with `border: none !important`, and `!important` inside a layer beats unlayered CSS,
 * so those stopgaps could not have reinstated a control's frame anyway. modyra-modern.css is
 * self-contained and uses no `!important`, so the precedence story above actually holds.
 */
import { readFileSync, writeFileSync, mkdirSync, cpSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
// modyra-modern.css declares its dependencies the way every other variant theme does, with
// `@import './modyra-base.css'; @import './modyra.css';`. Studio inlines the stylesheet into a
// single bundled file, so nothing is ever fetched at runtime and those imports have to be
// resolved here — in the order the theme declares them, with the statements dropped.
const themeChain = ["modyra-base.css", "modyra.css", "modyra-modern.css"];
const theme = themeChain
  .map((file) => readFileSync(here(`../styles/dist/${file}`), "utf8").replace(/@import\s+[^;]+;/g, ""))
  .join("\n");
const studio = readFileSync(here("./src/studio.css"), "utf8");

mkdirSync(here("./dist/fonts"), { recursive: true });
writeFileSync(here("./dist/studio.css"), `${theme}\n\n${studio}`);
cpSync(here("./src/fonts"), here("./dist/fonts"), { recursive: true });
