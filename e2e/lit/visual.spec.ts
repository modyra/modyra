import { test } from "@playwright/test";
import { declareVisualBaselines } from "../support/visual.js";

/** `@modyra/lit`'s baselines, under the same rules and against its own stylesheet link. */
test.describe("the lit demo, per theme", () => {
  declareVisualBaselines({
    themeLinkId: "theme",
    ready: ".mdy-renderer--text",
    // The attribute a host sets, driven the way a host would: this renderer offers the modal
    // placement and the baseline covers it because of that, not because the test arranged it.
    forceModal: async (page) => {
      await page.evaluate(() => {
        document.querySelector("mdy-datepicker-field")?.setAttribute("variant", "modal");
      });
      await page.waitForTimeout(50);
    },
  });
});
