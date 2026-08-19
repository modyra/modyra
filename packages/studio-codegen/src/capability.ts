/**
 * What a target cannot draw, said by the target that cannot draw it.
 *
 * A target declares the field kinds it supports in `capabilities.fieldKinds`, and that list is the
 * only statement in the system about what *this* generator can express. A field whose kind is not
 * in it still generates — a kind nobody declared becomes a leaf holding whatever the author typed —
 * so the code compiles and the author's tooling is quiet about a field that is not the one they
 * drew.
 *
 * The contract compiler reaches the same conclusion for its own document, but a target that emits
 * code answers a different question: it carries things the Dynamic Form Contract has no equivalent
 * for. So this is read from what the target declares about itself rather than borrowed from
 * elsewhere, and it says nothing when the target does declare the kind.
 */
import type { MdyStudioProject, StudioDiagnostic } from "@modyra/studio-model";
import type { TargetCapabilities } from "./types.js";

interface SchemaNode {
  readonly node?: string;
  readonly name?: string;
  readonly id?: string;
  readonly fieldKind?: string;
  readonly children?: ReadonlyArray<SchemaNode>;
  readonly item?: SchemaNode;
}

/** Every field in the tree, at any depth, including the rows of a collection. */
function fieldsOf(node: SchemaNode | undefined, into: SchemaNode[]): SchemaNode[] {
  if (!node || typeof node !== "object") return into;
  if (node.node === "field") into.push(node);
  if (Array.isArray(node.children)) for (const child of node.children) fieldsOf(child, into);
  fieldsOf(node.item, into);
  return into;
}

/**
 * One `warning` per field whose kind the target does not declare, and nothing at all otherwise.
 *
 * `warning` rather than `error`: the field is generated, so the project is still compatible — what
 * is lost is the rendering the author asked for, and an error here would cost them every other
 * field to report one.
 */
export function capabilityDiagnostics(
  project: MdyStudioProject,
  target: { readonly id: string; readonly capabilities: TargetCapabilities },
): StudioDiagnostic[] {
  const declared = new Set(target.capabilities.fieldKinds);
  return fieldsOf(project.schema as unknown as SchemaNode, [])
    .filter((field) => typeof field.fieldKind === "string" && !declared.has(field.fieldKind))
    .map((field) => ({
      code: "UNSUPPORTED_FIELD_KIND",
      severity: "warning" as const,
      targetId: target.id,
      ...(field.id === undefined ? {} : { nodeId: field.id }),
      message:
        `Field "${field.name ?? field.id ?? "(unnamed)"}" has kind "${String(field.fieldKind)}", which this ` +
        `target does not support — it is generated as a plain field, so what it holds survives and the ` +
        `control the author chose does not.`,
    }));
}
