/**
 * What `@modyra/styles` publishes, and what each published sheet is.
 *
 * Two gates need to know which sheets are themes. One derived it from the package manifest; the
 * other carried a regex of six file names — and that regex did not match `modyra-salience.theme.css`,
 * so the salience theme was never a theme as far as it was concerned. A frozen list is the same
 * defect as a frozen file check: what it does not name, it excuses, and it excuses it silently.
 *
 * The roster is the manifest. The roles below are a declaration, not a list that can quietly fall
 * behind: a published subpath with no entry here is reported by the caller, because the alternative
 * is that publishing a new theme is how a sheet stops being audited.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** What each published subpath is. A subpath absent from here is unclassified, which is a finding. */
export const SHEET_ROLES = {
  // The foundation a consumer imports, and the half it imports in turn. Both decide how a control
  // works, so both are held to what a foundation may not assume.
  "foundation.css": "foundation",
  // Not published on its own; loaded by the sheet above. Kept in the roster because the rules are
  // about the tier, not about which file a consumer names.
  "modyra.css": "foundation",
  // The brand token tier (`--mdy-ref-*`). Reference tokens are exactly the raw brand values a
  // foundation must not contain and something has to declare, so this one is neither.
  "base.css": "neither",
  "default.css": "theme",
  "modern.css": "theme",
  "material.css": "theme",
  "ios.css": "theme",
  "salience.css": "theme",
  "ionic.css": "theme",
};

/** The file each published subpath resolves to, read from the manifest rather than guessed. */
export function publishedSheets() {
  const manifest = JSON.parse(readFileSync(join(ROOT, "packages/styles/package.json"), "utf8"));
  const sheets = new Map();
  for (const [subpath, target] of Object.entries(manifest.exports ?? {})) {
    const file = typeof target === "string" ? target : target?.default;
    if (typeof file !== "string" || !file.endsWith(".css")) continue;
    sheets.set(subpath.replace(/^\.\//, ""), file.replace(/^.*\//, ""));
  }
  return sheets;
}

/** Published subpaths this declaration does not classify — a finding wherever it is asked. */
export function unclassifiedSheets() {
  return [...publishedSheets().keys()].filter((subpath) => !(subpath in SHEET_ROLES));
}

/** The file names of the published themes, which is what a sheet-by-name check needs. */
export function themeSheetFiles() {
  return new Set([...publishedSheets()]
    .filter(([subpath]) => SHEET_ROLES[subpath] === "theme")
    .map(([, file]) => file));
}
