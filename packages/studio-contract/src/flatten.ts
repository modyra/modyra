/**
 * Flattens a compiled Contract v2 envelope (compileToContract's own output)
 * to the flat MdyDynamicField[] shape a Contract renderer (@modyra/react's
 * useMdyDynamicForm, @modyra/angular's <mdy-dynamic-form>, @modyra/plain's
 * mountMdyForm) consumes. Lives here rather than in studio-ui: studio-ui
 * deliberately never depends on @modyra/core directly (see
 * packages/studio-preview/src/index.ts's own barrel-export comment for the
 * same reasoning) — studio-contract already depends on it to build the
 * Contract in the first place, so it is the natural bridge.
 */
import { parseDynamicForm, type MdyDynamicField, type MdyDynamicFormConfigV2 } from "@modyra/core";

/** Re-parses (and re-flattens) an already-compiled Contract. Always `{mode:"strict"}` — compileToContract only ever returns a contract that already parsed clean, so a second strict parse here can only reject if something upstream regressed, never surprise a caller with a silently-lenient result. */
export function flattenContractFields(contract: MdyDynamicFormConfigV2): readonly MdyDynamicField[] {
  return parseDynamicForm(contract, { mode: "strict" }).fields;
}
