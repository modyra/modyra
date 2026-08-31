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
