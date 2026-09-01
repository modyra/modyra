/**
 * The conformance config for the stub of issue #2 — the shape `packages/plain/conformance.config.mjs`
 * shows, with nothing in it but what the kit asks for.
 */
import { installDocument } from "../../battle-tests/harness/dom-env.mjs";

installDocument();

const stub = await import("./stub-renderer.mjs");

export const name = "@modyra/stub (issue #2)";
export const kinds = stub.KINDS;
export const mount = stub.mount;
export const mountScoped = stub.mountScoped;
// Forwarded rather than written here: the claim belongs to the renderer that either passes the rules
// on or does not, and a config asserting it over a mount that drops them is the lie the kit warns
// about — it would turn "not established" into a defect reported against a request never made.
export const declaresRules = stub.declaresRules;
