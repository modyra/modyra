/**
 * Compile-time dev flag. Production builds may define `__MDY_DEV__ = false`
 * to drop dev-only warning code and its message strings entirely:
 *
 * - esbuild:  `--define:__MDY_DEV__=false`
 * - rollup:   `@rollup/plugin-replace` → `__MDY_DEV__: "false"`
 * - vite:     `define: { __MDY_DEV__: "false" }`
 *
 * Without the define the flag is true and behavior is unchanged; the
 * runtime `devWarnings: false` option keeps working independently.
 */
declare const __MDY_DEV__: boolean | undefined;

export const MDY_DEV: boolean =
  typeof __MDY_DEV__ === "undefined" || __MDY_DEV__;
