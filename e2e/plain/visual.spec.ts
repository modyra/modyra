import { test } from "@playwright/test";
import { declareVisualBaselines } from "../support/visual.js";

/** `@modyra/plain`'s baselines. Everything shared is in the helper; this states what differs. */
test.describe("the plain demo, per theme", () => {
  declareVisualBaselines({
    themeLinkId: "modyra-theme",
    ready: ".mdy-renderer--text",
    // The bench, not the front door: this renderer's front door is a demo written to be read and
    // rewritten, and every rewrite moves the widgets under it by a fraction of a pixel. Lit keeps
    // its own front door here because lit's has not become one.
    at: "/lab.html",
  });
});
