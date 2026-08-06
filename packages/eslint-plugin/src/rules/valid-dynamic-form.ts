import { parseDynamicForm } from "@modyra/core/dynamic-config";
import { evaluate, isUnknown, propertyKey, resolvePath, unwrapTypeOnly } from "../static-value.js";
import type { EsNode } from "../static-value.js";

/**
 * Reports the contract's own diagnostics against the document a source literal states.
 *
 * The rule decides nothing about validity. It has no list of kinds, no table of which kinds need
 * options and no name grammar: it hands the reconstructed document to `parseDynamicForm` and
 * reports what comes back. A rule that knew any of those separately would be a second answer to a
 * question the parser already answers, and the two would agree only until the next release.
 */

/** The slice of ESLint's context a rule here uses. Exported because the rule's type names it. */
export interface RuleContext {
  report(descriptor: {
    node: unknown;
    messageId: string;
    data: Readonly<Record<string, string>>;
  }): void;
}

const asNode = (value: unknown): EsNode | undefined =>
  typeof value === "object" && value !== null && typeof (value as { type?: unknown }).type === "string"
    ? (value as EsNode)
    : undefined;

/**
 * Whether an object literal claims to be a form document.
 *
 * A version the parser knows, alongside one of the two slots that carry the form, is the document's
 * own self-description — which is what makes this cheap and parser-agnostic. A bare array of fields
 * is also a valid v1 document, and is deliberately not detected: every array literal in a codebase
 * would have to be treated as a candidate.
 */
const isFormDocument = (node: EsNode): boolean => {
  if (node.type !== "ObjectExpression") return false;
  const properties = Array.isArray(node["properties"]) ? node["properties"] : [];
  let versioned = false;
  let carriesForm = false;

  for (const raw of properties) {
    const property = asNode(raw);
    if (!property || property.type !== "Property") continue;
    const key = propertyKey(property);
    if (key === "fields" || key === "schema") carriesForm = true;
    if (key !== "version") continue;
    const value = asNode(property["value"]);
    const version = value ? unwrapTypeOnly(value) : undefined;
    if (version?.type === "Literal" && (version["value"] === 1 || version["value"] === 2 || version["value"] === 3)) {
      versioned = true;
    }
  }

  return versioned && carriesForm;
};

const rule = {
  meta: {
    type: "problem" as const,
    docs: {
      description:
        "Report the Modyra Dynamic Form Contract's diagnostics for a form document written as a literal",
    },
    schema: [],
    messages: {
      // The code travels with the message so a reader can search for it and find the same finding
      // in the console and in CI.
      diagnostic: "{{message}} ({{code}})",
    },
  },

  create(context: RuleContext) {
    return {
      ObjectExpression(node: EsNode): void {
        if (!isFormDocument(node)) return;

        const document = evaluate(node);
        // Silence is the contract with the reader: a document assembled from a spread, a helper or
        // an imported constant is only partly visible here, and reporting on the part that is
        // visible invents absences. See ADR 0024.
        if (isUnknown(document)) return;

        // The parse mode changes which values survive, not which diagnostics are produced, so the
        // default is what a lint pass wants: every finding, none of the discarding.
        for (const diagnostic of parseDynamicForm(document).diagnostics) {
          context.report({
            node: resolvePath(node, diagnostic.path),
            messageId: "diagnostic",
            data: { code: diagnostic.code, message: diagnostic.message },
          });
        }
      },
    };
  },
};

export default rule;
