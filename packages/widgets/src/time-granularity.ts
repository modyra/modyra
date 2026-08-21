/**
 * Which times a picker offers — the engine's, re-exported.
 *
 * The rule belongs to `@modyra/core`: a document declares a granularity, and a document is parsed
 * before anything renders it. A second copy here would be a second answer to "does this step divide
 * its unit", which is the shape a widget contract exists to prevent rather than to have.
 */
export type { MdyTimepickerViewMode } from "@modyra/core";

export {
  explainGranularityProblem,
  isOnStep,
  MDY_EVERY_TIME,
  minutesOfDay,
  timeStepsAt,
  validateTimeGranularity,
  type MdyGranularityProblem,
  type MdyTimeGranularity,
  type MdyTimeSteps,
  type MdyTimeWindow,
} from "@modyra/core";
