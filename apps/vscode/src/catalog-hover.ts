import { MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS } from "@modyra/widgets";

/**
 * What a widget kind is, read from the catalogue at the moment it is asked.
 *
 * The catalogue is the UI contract; describing a kind here in prose would be a second description
 * of it, correct until the next part is added. Everything below is a projection of
 * `MDY_WIDGET_CONTRACTS` — a kind that gains a part gains it in the hover on the same build.
 */

const isKind = (value: string): value is (typeof MDY_WIDGET_KINDS)[number] =>
  (MDY_WIDGET_KINDS as readonly string[]).includes(value);

/** Markdown describing `kind`, or undefined when the catalogue has no such kind. */
export const describeKind = (kind: string): string | undefined => {
  if (!isKind(kind)) return undefined;
  const definition = MDY_WIDGET_CONTRACTS[kind];

  const lines: string[] = [`### \`${kind}\``];

  const parts = Object.keys(definition.parts);
  lines.push("", `**Parts** — ${parts.length > 0 ? parts.map((part) => `\`${part}\``).join(", ") : "none"}`);

  lines.push("", `**Root class** — ${definition.rootClasses.map((name) => `\`.${name}\``).join(", ")}`);

  if (definition.capabilities.overlay) {
    // Only stated when true: "overlay: no" on eleven kinds is noise in a tooltip, and the absence
    // says the same thing to anyone who has seen it present.
    const dismiss = definition.capabilities.dismissOnOutsidePointer;
    lines.push("", `**Overlay** — yes${dismiss ? ` · \`${dismiss}\` on an outside pointer` : ""}`);
  }

  const variants = Object.entries(definition.variants);
  if (variants.length > 0) {
    lines.push("", "**Varies by configuration**");
    for (const [name, variant] of variants) {
      const required = variant?.required ?? [];
      lines.push(`- \`${name}\` — ${required.length > 0 ? `requires ${required.map((p) => `\`${p}\``).join(", ")}` : "same parts"}`);
    }
  }

  return lines.join("\n");
};

/** Every kind the catalogue holds, for a caller that wants to offer them all. */
export const kinds = (): readonly string[] => MDY_WIDGET_KINDS;
