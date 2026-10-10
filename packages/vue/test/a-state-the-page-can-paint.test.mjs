/**
 * A state the field is in is a class the page can paint.
 *
 * `shellStateClasses` is the contract's answer to which class each state puts on the field, its
 * input wrapper and its caption: a refused field is `--error` on the wrapper and `--has-error` on the
 * caption, a field held for review is `--readonly`, a switched-off one `--disabled`, a caption over a
 * value `--filled`. A renderer that reflects only `--touched` on the root leaves every theme with
 * nothing to key on, so a refused field looks valid and a locked form looks like one to fill in.
 *
 * Asked of the same door the component uses, with the state put on the field through the form.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();

const config = await import("../conformance.config.mjs");
const { MDY_WIDGET_CONTRACTS, partClasses, shellStateClasses, valueIsPresent } = await import("@modyra/widgets");

/** The kinds whose shell this renderer reflects. */
const KINDS = config.kinds.filter((kind) =>
  ["text", "email", "password", "textarea", "number", "checkbox", "toggle", "slider", "file",
    "radio", "segmented", "select", "multiselect", "colors"].includes(kind));

const on = (classes) => Object.entries(classes).filter(([, isOn]) => isOn).map(([name]) => name);

const find = (kind, part) => {
  const classes = partClasses(kind, part);
  return classes.length === 0 ? null : document.querySelector(classes.map((one) => `.${one}`).join(""));
};

const STATES = {
  invalid: { drive: "invalid", expected: { error: true } },
  readonly: { drive: "readonly", expected: { readonly: true } },
  disabled: { drive: "disabled", expected: { disabled: true } },
};

for (const kind of KINDS) {
  for (const [name, { drive, expected }] of Object.entries(STATES)) {
    test(`${kind}, ${name}: the wrapper and the caption wear the classes the state puts on`, async () => {
      const fixture = await config.mount(kind, {});
      try {
        await fixture.settle?.();
        assert.ok(fixture.drive(drive), `${kind} cannot be put in ${name}`);
        await fixture.settle?.();
        const shell = shellStateClasses(expected);
        const label = find(kind, "label");
        assert.ok(label, `${kind} drew no caption`);
        for (const one of on(shell.label)) assert.ok(label.classList.contains(one), `${kind} ${name}: the caption lacks ${one}`);
        const declaresWrapper = MDY_WIDGET_CONTRACTS[kind].structure.nodes.some((node) => node.part === "inputWrapper");
        const wrapper = declaresWrapper ? find(kind, "inputWrapper") : null;
        if (wrapper !== null) {
          for (const one of on(shell.control)) assert.ok(wrapper.classList.contains(one), `${kind} ${name}: the wrapper lacks ${one}`);
        }
      } finally {
        fixture.dispose?.();
      }
    });
  }
}

for (const kind of KINDS) {
  test(`${kind}: a caption says it is filled exactly when the field holds a value`, async () => {
    const fixture = await config.mount(kind, {});
    try {
      await fixture.settle?.();
      const [filled] = on(shellStateClasses({ filled: true }).label);
      for (const drive of ["empty", "filled"]) {
        fixture.drive(drive);
        await fixture.settle?.();
        // Whether the value is there is the contract's question, asked of the value the field holds.
        const present = valueIsPresent(kind, fixture.value());
        assert.equal(find(kind, "label")?.classList.contains(filled), present,
          `${kind} ${drive}: the caption ${present ? "lacks" : "wears"} ${filled}`);
      }
    } finally {
      fixture.dispose?.();
    }
  });
}
