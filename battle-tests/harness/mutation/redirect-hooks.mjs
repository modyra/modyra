/**
 * Reads one package from a copy of its build, so a defect can be planted without writing to the tree.
 *
 * Resolution stays the real one — the package's own export map included — and only the file that
 * comes out of it is moved onto the copy. The copy lives outside the workspace, so its own
 * `@modyra/*` neighbours would not resolve: they are anchored to the real package first.
 *
 * Every redirection appends a line to `MDY_HOOK_LOG`. A run that produces no lines measured the real
 * tree, and its result says nothing about the defect that was planted.
 */
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const REAL = pathToFileURL(`${process.env.MDY_REAL_DIR}/`).href;
const MUTANT = pathToFileURL(`${process.env.MDY_MUTANT_DIR}/`).href;
const ANCHOR = pathToFileURL(`${process.env.MDY_REAL_DIR}/index.js`).href;
const LOG = process.env.MDY_HOOK_LOG;

export async function resolve(specifier, context, next) {
  const fromCopy = context.parentURL?.startsWith(MUTANT) === true;
  const resolved = fromCopy && !specifier.startsWith(".")
    ? await next(specifier, { ...context, parentURL: ANCHOR })
    : await next(specifier, context);
  if (!resolved.url.startsWith(REAL)) return resolved;
  const url = MUTANT + resolved.url.slice(REAL.length);
  if (LOG !== undefined) appendFileSync(LOG, `${url}\n`);
  return { ...resolved, url, shortCircuit: true };
}
