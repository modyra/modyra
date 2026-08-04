import { test } from "@playwright/test";
import { declareVisualBaselines } from "../support/visual.js";

/** `@modyra/lit`'s baselines, under the same rules and against its own stylesheet link. */
test.describe("the lit demo, per theme", () => {
  declareVisualBaselines({ themeLinkId: "theme", ready: ".mdy-renderer--text" });
});
