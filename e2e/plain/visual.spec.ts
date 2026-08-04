import { test } from "@playwright/test";
import { declareVisualBaselines } from "../support/visual.js";

/** `@modyra/plain`'s baselines. Everything shared is in the helper; this states what differs. */
test.describe("the plain demo, per theme", () => {
  declareVisualBaselines({ themeLinkId: "modyra-theme", ready: ".mdy-renderer--text" });
});
