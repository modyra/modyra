/**
 * Where a break was found.
 *
 * A report that says only "it failed" cannot be triaged: the same claim can hold in Node and break
 * in a browser, hold in the workspace and break in a packed consumer. The environment name is part
 * of the failure identity, not decoration.
 */

export const ENVIRONMENT_ENV = "MDY_BATTLE_ENV";

export function describeEnvironment(env = process.env) {
  return Object.freeze({
    name: env[ENVIRONMENT_ENV] ?? "node",
    runtime: `node ${process.version}`,
    platform: `${process.platform}-${process.arch}`,
    /** Which packages the suite resolved, so a stale build cannot be mistaken for a break. */
    consumed: "workspace",
  });
}
