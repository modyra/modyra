/**
 * The stub of issue #2, with a browser attached.
 *
 *   node packages/widgets/bin/modyra-conformance.mjs examples/baseline/stub.conformance.browser.config.mjs
 *
 * The Node config answers eight of ten sections. The two it leaves as *not established* — keyboard
 * behaviour and the accessibility audit — are the ones a DOM shim cannot answer, and they are also
 * the two that produced eleven findings the first time anything ran them against a real renderer. A
 * naive adapter that is never asked those questions cannot show whether the contract teaches them,
 * which is the whole claim the stub exists to test.
 *
 * **The page is a snapshot of what the renderer produced, and carries none of its script.** The stub
 * has no script — it writes elements and stops — so this is not a simplification, it is the subject.
 * What the sections then measure is what the markup earns from the platform on its own: a native
 * `<input type="checkbox">` toggles on Space because the browser does it, and an overlay built from
 * `<div>`s opens on nothing at all. That difference is exactly the report a naive adapter owes: not
 * "this renderer is bad", but "here is what the contract asked for and the markup did not deliver".
 *
 * So a red here is the expected outcome and the useful one. It fails B3's threshold only if the reds
 * do not *name* what is missing.
 */
import { chromium } from "@playwright/test";

import { installDocument } from "../../battle-tests/harness/dom-env.mjs";

installDocument();

const stub = await import("./stub-renderer.mjs");

export { name, kinds, mount, mountScoped, declaresRules } from "./stub.conformance.config.mjs";

let browserPromise;
function launchBrowser() {
  browserPromise ??= chromium.launch();
  return browserPromise;
}

/**
 * One page holding one kind, rendered by the stub and handed to the platform.
 *
 * Mounted in the shim and serialised rather than served from a build: the stub is a file, not a
 * package, and giving it a bundler to prove it renders two kinds would put a build between the
 * question and the answer.
 */
export async function openBrowserSession(kind) {
  let markup = "";
  let fixture;
  try {
    fixture = stub.mount(kind, {});
    markup = fixture.root?.outerHTML ?? "";
  } finally {
    fixture?.dispose?.();
  }

  // **The transport asserts that it has a subject.** A declared kind that serialises to nothing is
  // this file failing, not the renderer: every section would then run against an empty page and
  // report zero of everything — zero keys pressed, zero elements named — under a green heading. The
  // first form of this file did exactly that, because it passed a host the stub does not accept and
  // read back the host it had filled with nothing.
  if (markup.trim().length === 0) {
    throw new Error(`the stub declares "${kind}" and rendered no markup: the transport has no subject`);
  }

  const browser = await launchBrowser();
  const page = await browser.newPage();
  // A document rather than a fragment: the accessibility tree is computed against a real document,
  // and a name resolved outside one is not the name a screen reader would announce.
  await page.setContent(`<!doctype html><html lang="en"><body><div id="mdy-stub-root">${markup}</div></body></html>`);

  const root = page.locator("#mdy-stub-root");

  const evaluate = async (source) => {
    return root.evaluate((element, body) => new Function(`return (${body})`)()(element), source);
  };

  return {
    evaluate,
    /**
     * Focus wherever this markup can be focused at all.
     *
     * The stub declares no opener and names no part, so there is nothing to try in order — which is
     * itself the finding. Focus is asserted after it is requested for the same reason it is in every
     * other config: an element that cannot take focus accepts the request silently, and a key then
     * goes to the document and is reported against the renderer.
     */
    async focusOpener() {
      const candidate = root.locator("input, select, textarea, button, [tabindex]").first();
      if ((await candidate.count()) === 0) return false;
      await candidate.focus();
      return candidate.evaluate((element) => element === element.ownerDocument.activeElement);
    },
    async press(key) {
      await page.keyboard.press(key === " " ? "Space" : key);
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => done(null))));
    },
    async close() {
      await page.close();
    },
  };
}

export async function disposeBrowser() {
  if (browserPromise) await (await browserPromise).close();
  browserPromise = undefined;
}
