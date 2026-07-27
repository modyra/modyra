import type { MdyWidgetStructure } from "../structure.js";

export interface MdyStructureContractIssue {
  readonly code: "DUPLICATE_PART" | "DUPLICATE_ORDER" | "MISSING_PARENT" | "ROOT_HAS_PARENT";
  readonly part: string;
  readonly message: string;
}

/** Pure conformance check shared by framework adapter test harnesses. */
export function inspectWidgetStructure(structure: MdyWidgetStructure): readonly MdyStructureContractIssue[] {
  const issues: MdyStructureContractIssue[] = [];
  const names = new Set<string>();
  for (const node of structure.nodes) {
    if (names.has(node.part)) issues.push({ code: "DUPLICATE_PART", part: node.part, message: `Duplicate part: ${node.part}` });
    names.add(node.part);
  }
  for (const node of structure.nodes) {
    if (node.element === "root" && node.parent !== undefined) {
      issues.push({ code: "ROOT_HAS_PARENT", part: node.part, message: `Root part ${node.part} cannot have a parent` });
    }
    if (node.parent !== undefined && !names.has(node.parent)) {
      issues.push({ code: "MISSING_PARENT", part: node.part, message: `Unknown parent ${node.parent} for ${node.part}` });
    }
  }
  const siblingOrders = new Set<string>();
  for (const node of structure.nodes) {
    const key = `${node.parent ?? "<root>"}:${node.order}`;
    if (siblingOrders.has(key)) issues.push({ code: "DUPLICATE_ORDER", part: node.part, message: `Duplicate sibling order ${node.order}` });
    siblingOrders.add(key);
  }
  return issues;
}

/** Throws a focused error suitable for adapter conformance suites. */
export function assertWidgetStructureContract(structure: MdyWidgetStructure): void {
  const issues = inspectWidgetStructure(structure);
  if (issues.length > 0) throw new Error(issues.map((issue) => `${issue.code}: ${issue.message}`).join("\n"));
}
