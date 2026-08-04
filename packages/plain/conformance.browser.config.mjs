/**
 * `@modyra/plain`'s conformance config, with a browser attached.
 *
 *   node packages/widgets/bin/modyra-conformance.mjs packages/plain/conformance.browser.config.mjs
 *
 * Everything the Node config declares is re-exported unchanged, so the six sections that need no
 * browser are the same run. What this adds is `openBrowserSession`, which is the transport the kit
 * asks for: real key presses, real focus, and names computed by the platform rather than guessed.
 *
 * It is a separate file because the browser is a separate cost. The Node config runs anywhere with
 * a DOM shim and finishes in a second; this one starts a server and a browser, and a check nobody
 * runs because it is slow is a check that does not exist.
 *
 * The assertions are not here. The kit sends the function to evaluate and reads the result, so this
 * file cannot make its own renderer look conformant by asking an easier question — which is the
 * failure a per-renderer browser suite invites, and the reason the transport and the rules are
 * split.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

export { name, kinds, mount, absentParts, variants, mountScoped } from "./conformance.config.mjs";

const EXAMPLE_ROOT = resolve(new URL("../../dist/examples/plain", import.meta.url).pathname);
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".map": "application/json",
};

/**
 * The example, served the way a browser needs it.
 *
 * Started once and shared: a server per session would spend more time binding ports than pressing
 * keys, and the sections open a session per kind and per binding.
 */
let serverPromise;
function serveExample() {
  serverPromise ??= new Promise((ready, fail) => {
    const server = createServer(async (request, response) => {
      const path = normalize(request.url === "/" ? "/index.html" : (request.url ?? "/"))
        .replace(/^([/\\])+/, "");
      try {
        const body = await readFile(join(EXAMPLE_ROOT, path));
        response.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
        response.end(body);
      } catch {
        response.writeHead(404);
        response.end("not found");
      }
    });
    server.on("error", fail);
    server.listen(0, "127.0.0.1", () => ready({ server, port: server.address().port }));
  });
  return serverPromise;
}

let browserPromise;
async function launchBrowser() {
  browserPromise ??= (async () => {
    // Imported here rather than at module scope: the Node config must stay loadable without a
    // browser installed, and this file is what declares the extra requirement.
    const { chromium } = await import("@playwright/test");
    return chromium.launch();
  })();
  return browserPromise;
}

/**
 * One page, scoped to the widget of one kind.
 *
 * The example renders every kind on one page, so the session resolves which element the kit's
 * assertions run against. That resolution is renderer-specific — a class the catalogue declares
 * here, a custom element elsewhere — which is exactly why the kit asks the config for it instead of
 * assuming one shape.
 */
export async function openBrowserSession(kind) {
  const { port } = await serveExample();
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForSelector(".mdy-renderer", { state: "attached", timeout: 15_000 });

  const root = page.locator(`.mdy-renderer--${kind}`).first();
  const present = (await root.count()) > 0;

  /** The kit sends a function's source; it is compiled in the page and handed the widget's root. */
  const evaluate = async (source) => {
    if (!present) return null;
    return root.evaluate((element, body) => {
      // Compiled in the page from source the kit sent. That is the mechanism rather than a shortcut:
      // the rules live in one place and run where the answers are. The source is the kit's own — it
      // never carries anything a page or a user supplied.
      return new Function(`return (${body})`)()(element);
    }, source);
  };

  return {
    evaluate,
    /**
     * Focus where the widget's keys are handled.
     *
     * Tried in order, and the order is the whole of it: a comma-separated selector resolves in DOM
     * order, so a datepicker's text input wins over the toggle that actually owns the overlay keys —
     * and every binding then reports the renderer for ignoring a key delivered to the wrong element.
     */
    async focusOpener() {
      if (!present) return false;
      const candidates = [
        ".mdy-select__trigger",
        ".mdy-datepicker__toggle",
        ".mdy-timepicker__toggle",
        ".mdy-colors__toggle-area",
        ".mdy-multiselect__search-btn",
        "input, select, textarea, button",
      ];
      for (const candidate of candidates) {
        const opener = root.locator(candidate).first();
        if ((await opener.count()) === 0) continue;
        await opener.focus();
        return true;
      }
      return false;
    },
    async press(key) {
      await page.keyboard.press(key === " " ? "Space" : key);
      // One frame, so what the key did has been rendered before it is read.
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => done(null))));
    },
    async close() {
      await page.close();
    },
  };
}

/**
 * Closes what the sessions share.
 *
 * Without it the process stays alive on the listening socket and the browser, and a conformance run
 * that never exits reads as a hung suite rather than a passing one.
 */
export async function disposeBrowser() {
  if (browserPromise) await (await browserPromise).close();
  if (serverPromise) (await serverPromise).server.close();
  browserPromise = undefined;
  serverPromise = undefined;
}
