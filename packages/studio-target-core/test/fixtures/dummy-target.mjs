/**
 * A trivial target used only to prove the platform: full StudioTarget
 * implementation (schema traversal, options, capabilities) with zero
 * framework code. Not shipped — proves "dummy target needs no canvas
 * change" (P7 gate) by existing entirely outside studio-model/studio-editor/
 * studio-ui, registered the same way any real target eventually would be.
 */
function collectFieldNames(node, out = []) {
  if (node.node === "field") out.push(node.name);
  else if (node.node === "group") node.children.forEach((child) => collectFieldNames(child, out));
  else collectFieldNames(node.item, out);
  return out;
}

export function createDummyTarget() {
  return {
    id: "dummy",
    displayName: "Dummy (JSON echo)",
    version: "0.0.1",
    capabilities: {
      fieldKinds: ["text", "textarea", "email", "number", "checkbox", "select", "multiselect", "date"],
      validatorKinds: ["required", "email", "min", "max", "minLength", "maxLength", "pattern"],
      supportsArrays: true,
      supportsGroups: true,
      supportsServerValidators: false,
      supportsFormValidators: false,
    },
    defaults() {
      return { pretty: true };
    },
    async analyze() {
      return { compatible: true, diagnostics: [] };
    },
    async generate(project, options) {
      const fieldNames = collectFieldNames(project.schema);
      const summary = { projectId: project.id, fieldNames };
      const content = options.pretty ? JSON.stringify(summary, null, 2) : JSON.stringify(summary);
      return {
        targetId: "dummy",
        files: [{ path: "form.json", language: "json", content, role: "source" }],
        diagnostics: [],
        entryFile: "form.json",
      };
    },
  };
}

export function createDummyTargetManifest() {
  return {
    id: "dummy",
    displayName: "Dummy (JSON echo)",
    load: async () => createDummyTarget(),
  };
}
