import validDynamicForm from "./rules/valid-dynamic-form.js";

/**
 * ESLint rules that surface the Dynamic Form Contract's diagnostics while the contract is being
 * written, rather than on a dev build once the form has failed to render.
 *
 * The findings are the parser's. This package positions them; it does not decide them.
 */
const plugin = {
  meta: { name: "@modyra/eslint-plugin" },
  rules: {
    "valid-dynamic-form": validDynamicForm,
  },
};

/** Turns the rules on at the severity the contract already assigns its diagnostics: error. */
export const configs = {
  recommended: {
    name: "modyra/recommended",
    plugins: { modyra: plugin },
    rules: { "modyra/valid-dynamic-form": "error" },
  },
};

export const { meta, rules } = plugin;

export default { ...plugin, configs };
