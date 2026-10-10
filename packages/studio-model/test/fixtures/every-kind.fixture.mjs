import { STUDIO_FIELD_KINDS } from "../../dist/index.js";

const OPTION_KINDS = new Set(["select", "radio", "segmented", "multiselect"]);

/** What each kind holds, which is what a code target spells as the field's initial value. */
const VALUE = {
  checkbox: ["boolean", false],
  toggle: ["boolean", false],
  number: ["number", 0],
  slider: ["number", 0],
  date: ["date", ""],
  time: ["string", ""],
  multiselect: ["string[]", []],
};

/** One field of every kind the model declares, named after its kind. */
export function createEveryKindProject() {
  return {
    studioVersion: 1,
    id: "every_kind",
    name: "Every kind",
    schema: {
      node: "group",
      id: "root",
      name: "root",
      children: STUDIO_FIELD_KINDS.map((kind) => {
        const [valueType, initialValue] = VALUE[kind] ?? ["string", ""];
        return {
          node: "field",
          id: `nd_${kind}`,
          name: kind,
          fieldKind: kind,
          valueType,
          initialValue,
          validators: [],
          ...(OPTION_KINDS.has(kind) ? { options: [{ value: "a", label: "A" }, { value: "b", label: "B" }] } : {}),
        };
      }),
    },
    formValidators: [],
    behaviors: {},
    implementations: {},
    presentation: {},
    targets: {},
    metadata: {},
  };
}
