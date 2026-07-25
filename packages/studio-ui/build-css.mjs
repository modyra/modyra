/**
 * Ships the Modyra theme underneath Studio's own chrome.
 *
 * The theme is entirely inside `@layer mdy.*` (verified: zero unlayered bytes), and unlayered
 * CSS always beats layered CSS regardless of specificity. So concatenating it *before*
 * studio.css means it can only style what Studio does not already style — the widget parts
 * @modyra/plain emits (mdy-switch, mdy-label, mdy-datepicker__*, …) get the shipped look, and
 * no Studio rule can be overridden by it. That is what makes this safe to drop in wholesale.
 */
import { readFileSync, writeFileSync, mkdirSync, cpSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const theme = readFileSync(here("../styles/dist/modyra.css"), "utf8");
const studio = readFileSync(here("./src/studio.css"), "utf8");

mkdirSync(here("./dist/fonts"), { recursive: true });
writeFileSync(here("./dist/studio.css"), `${theme}\n\n${studio}`);
cpSync(here("./src/fonts"), here("./dist/fonts"), { recursive: true });
