/**
 * The dynamic form document, in one public face.
 *
 * Declaration, reading and compilation are three jobs with three different failure modes — a
 * malformed document, an unsupported shape, an engine that cannot express what was asked — and
 * they live in three modules. A consumer sees one document format.
 */

export {
  MDY_ID_DELIMITER,
  assertSafeDynamicFieldNames,
} from "./dynamic/guards.js";
export * from "./dynamic/members.js";
export * from "./dynamic/schema.js";
export * from "./dynamic/parse.js";
export * from "./dynamic/compile.js";
