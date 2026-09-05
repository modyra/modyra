/**
 * Observes one renderer and prints what it saw, as JSON, for `conformance-manifest.mjs`.
 *
 * A child process per renderer, because observing means installing a DOM and — for custom-element
 * renderers — registering tags in it. Two renderers in one process would share both, and the second
 * would be measured through the first's leftovers.
 *
 * Everything here is driven through the renderer's own state fixture, the same one its conformance
 * suite mounts. A separate fixture written for the manifest would be a second opinion about what
 * the renderer does, and the manifest would slowly stop describing the thing under test.
 */
import { MDY_WIDGET_KINDS } from "../../packages/widgets/dist/index.js";
import { dynamicParts } from "../../packages/widgets/dist/ssr.js";

const RENDERERS = {
  plain: {
    package: "@modyra/plain",
    domEnv: "../../packages/plain/test/support/dom-env.mjs",
    fixture: "../../packages/plain/test/support/state-fixture.mjs",
    entry: "../../packages/plain/dist/index.js",
  },
  lit: {
    package: "@modyra/lit",
    domEnv: "../../packages/lit/test/support/dom-env.mjs",
    fixture: "../../packages/lit/test/support/state-fixture.mjs",
    entry: "../../packages/lit/dist/index.js",
  },
  vue: {
    package: "@modyra/vue",
    domEnv: "../../packages/vue/test/support/dom-env.mjs",
    fixture: "../../packages/vue/test/support/state-fixture.mjs",
    entry: "../../packages/vue/dist/index.js",
  },
};

const name = process.argv[2];
const renderer = RENDERERS[name];
if (!renderer) {
  console.error(`observe-renderer: unknown renderer "${name}" — expected one of ${Object.keys(RENDERERS).join(", ")}`);
  process.exit(2);
}

const { installDomGlobals } = await import(renderer.domEnv);
installDomGlobals();

const { KINDS, mount } = await import(renderer.fixture);
const entry = await import(renderer.entry);

/** Names that would mean the package can turn a form into markup without a DOM. */
const SERVER_RENDER_EXPORTS = /^(render|hydrate).*(String|Markup|Stream|Static)|^ssr/i;

const kinds = {};
for (const kind of MDY_WIDGET_KINDS) {
  if (!KINDS.includes(kind)) {
    kinds[kind] = { rendered: false, reason: "the renderer's fixture does not list this kind" };
    continue;
  }

  const mounted = await mount(kind);
  await mounted.settle?.();

  const dynamic = dynamicParts(kind);
  const presentWhileClosed = dynamic.filter((part) => Boolean(mounted.parts()[part]));

  // Both sides are observed, and that is the point. "Absent while closed" alone cannot tell a
  // renderer that defers its popup from a fixture that cannot see the popup's parts at all — the
  // two produce the same empty list. Requiring the parts to *appear* on open makes lazy a positive
  // observation; a kind whose parts are never seen in either state is reported as neither.
  let presentWhileOpen = [];
  if (dynamic.length > 0) {
    await mounted.drive?.("open");
    await mounted.settle?.();
    presentWhileOpen = dynamic.filter((part) => Boolean(mounted.parts()[part]));
  }

  kinds[kind] = {
    rendered: Boolean(mounted.root),
    ...(dynamic.length > 0
      ? {
          overlay:
            presentWhileClosed.length > 0 ? "eager"
            : presentWhileOpen.length > 0 ? "lazy"
            : "unobservable",
          dynamicPartsWhileClosed: presentWhileClosed,
          dynamicPartsWhileOpen: presentWhileOpen,
        }
      : {}),
  };

  mounted.dispose();
}

const serverRenderExports = Object.keys(entry).filter((key) => SERVER_RENDER_EXPORTS.test(key));
const overlayKinds = Object.entries(kinds).filter(([, k]) => k.overlay);

console.log(JSON.stringify({
  renderer: renderer.package,
  kinds,
  features: {
    serverRender: {
      supported: serverRenderExports.length > 0,
      observedBy: "the package's exported symbols",
      evidence: serverRenderExports.length > 0
        ? `exports ${serverRenderExports.join(", ")}`
        : "no export turns a form into markup, so there is nothing a server could call",
    },
    lazyOverlays: {
      // True only if every overlay kind defers. One eager kind means a host cannot rely on it, and
      // an unobservable one is not evidence of deferral.
      supported: overlayKinds.length > 0 && overlayKinds.every(([, k]) => k.overlay === "lazy"),
      observedBy: "mounting each kind closed, then opening it, and looking for the parts inside its popup in both states",
      evidence: overlayKinds.length === 0
        ? "this renderer draws no kind with an overlay"
        : ["eager", "unobservable"]
            .map((verdict) => `${verdict}: ${overlayKinds.filter(([, k]) => k.overlay === verdict).map(([kind]) => kind).join(", ") || "none"}`)
            .join(" · "),
    },
  },
}));
