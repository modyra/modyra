/**
 * The colour arithmetic behind a theme, and the compiler that turns it into custom properties.
 *
 * These are what a *theme* is made of, not what a form is: nothing in the engine, the widget
 * contract or any renderer imports them, and the sheets in this package have named them in their
 * own comments all along. They lived in `@modyra/core` because that is where they were written,
 * which is a different reason from where they belong.
 *
 * The package stays a leaf: this half depends on nothing, and nothing depends on it — which is what
 * makes the move safe to state rather than merely intend.
 */
export * from "./color-utils.js";
export * from "./theme-compiler.js";
