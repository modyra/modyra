export { evaluateExpression } from "./expression-evaluator.js";
export { createMockAsyncValidator, createMockSubmitAction, type MockServerConfig } from "./mock-server.js";
export { buildLiveForm, type BuildLiveFormOptions, type LiveFormResult } from "./live-form-builder.js";

// Re-exported so a host (studio-ui) can build a shared reactivity instance and type its own
// preview-tab state without a direct @modyra/core dependency — matches the plan's own dependency
// diagram (section 4: "model/runtime services <- preview <- UI"), one hop at a time.
export { vanillaReactivity, type MdyFieldError, type MdyFormError, type MdyReactivity, type MdyTypedForm } from "@modyra/core";
