/** Imports a Studio project, compiles its contract and mounts it with `@modyra/plain`. */
import { loadProject, StudioModelError } from "@modyra/studio-model";
import { compileToContract, flattenContractFields } from "@modyra/studio-contract";
import { mountMdyForm, type MdyPlainForm } from "@modyra/plain";

const textarea = document.querySelector<HTMLTextAreaElement>("[data-plain-json]");
const fileInput = document.querySelector<HTMLInputElement>("[data-plain-file]");
const renderButton = document.querySelector<HTMLButtonElement>("[data-plain-render]");
const status = document.querySelector<HTMLElement>("[data-plain-status]");
const formHost = document.querySelector<HTMLElement>("[data-plain-form]");
if (!textarea || !fileInput || !renderButton || !status || !formHost) {
  throw new Error("Missing one of the expected [data-plain-*] mount points");
}

let mounted: MdyPlainForm | null = null;

function setStatus(message: string, isError: boolean): void {
  status!.textContent = message;
  status!.classList.toggle("error", isError);
}

function render(): void {
  let raw: unknown;
  try {
    raw = JSON.parse(textarea!.value);
  } catch {
    setStatus("Not valid JSON.", true);
    return;
  }

  let project;
  try {
    ({ project } = loadProject(raw));
  } catch (error) {
    setStatus(error instanceof StudioModelError ? error.message : String(error), true);
    return;
  }

  const { contract, diagnostics } = compileToContract(project);
  if (!contract) {
    setStatus(`Could not compile to a Contract: ${diagnostics.map((d) => d.message).join("; ")}`, true);
    return;
  }

  const fields = flattenContractFields(contract);
  if (fields.length === 0) {
    setStatus("Contract compiled, but has no renderable fields.", false);
    return;
  }

  mounted?.dispose();
  formHost!.replaceChildren();
  mounted = mountMdyForm(formHost!, fields, {
    onSubmit: (value) => {
      const keys = value && typeof value === "object" ? Object.keys(value as object) : [];
      setStatus(`Submitted successfully${keys.length > 0 ? ` (${keys.length} top-level fields)` : ""}.`, false);
    },
  });
  setStatus(`Rendered ${fields.length} field(s) via @modyra/plain.`, false);
}

renderButton.addEventListener("click", render);
fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  textarea.value = await file.text();
  render();
});
