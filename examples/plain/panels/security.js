/**
 * What the form does to a value it did not like.
 *
 * The client's checks are defence in depth — the server is the authority — and what they are for is
 * the value that arrives from somewhere nobody controls: a draft written by another script on the
 * origin, a server response, a paste. Every interception is reported rather than performed quietly,
 * because a value silently changed under a person is a bug they cannot see.
 */
import { createForm, field as mdyField } from "@modyra/core";
import { renderField } from "@modyra/plain";
import { action, grid, readoutPrinter, toolbar } from "./shell.js";

const MARKUP = '<img src=x onerror="alert(1)">Hello <b>there</b>';
const LONG = "x".repeat(300);

const FIELDS = [
  { name: "bio", kind: "textarea", label: "Bio (strict: no < > or quotes)" },
  { name: "nickname", kind: "text", label: "Nickname (capped at 24)" },
];

export const securityPanel = {
  id: "security",
  title: "Security",
  blurb:
    "Paste markup or press the buttons. The policy here is `strict`, which removes the characters markup is made of; `text` is the milder profile and removes only what is invisible. Every interception appears in the readout with what it did and why.",
  invariant:
    "A widget does not repair the model. Sanitizing happens at the boundary where a value enters the form, once, and it is reported — not applied again by each renderer and not applied silently.",

  mount(work, readout) {
    const violations = [];
    const form = createForm(
      { bio: mdyField(""), nickname: mdyField("") },
      {
        security: {
          sanitize: "strict",
          maxValueLength: 24,
          onViolation: (violation) => { violations.push(violation); print(); },
        },
      },
    );

    const bar = toolbar(work);
    const area = grid(work);
    const dispose = FIELDS.map((f) => renderField(area, f, form.f[f.name], form.reactivity));

    action(bar, "Paste markup", () => form.f.bio.set(MARKUP));
    action(bar, "Paste 300 characters", () => form.f.nickname.set(LONG));
    // A draft is storage another script on this origin can write to. Restoring one whose shape does
    // not match the schema is refused rather than merged, which is the structural half of the policy
    // and is on whether or not sanitizing is.
    action(bar, "Forge the stored draft", () => {
      try { localStorage.setItem("modyra-lab-draft", JSON.stringify({ value: { notAField: 1 } })); } catch { /* storage may be unavailable */ }
      print();
    });
    action(bar, "Clear the report", () => { violations.length = 0; print(); });

    const print = readoutPrinter(readout, () => ({
      value: form.getValue(),
      lengths: Object.fromEntries(FIELDS.map((f) => [f.name, String(form.f[f.name].value() ?? "").length])),
      violations: violations.map((v) => `${v.kind} at ${v.path ?? "(form)"} — ${v.detail}`),
      // What reached the DOM. The point of sanitizing at the boundary is that no renderer has to be
      // trusted to do it, so this is the number that proves it happened upstream.
      elementsInjected: area.querySelectorAll("img, script, b").length,
    }));

    const effect = form.reactivity.effect(() => {
      for (const f of FIELDS) form.f[f.name].value();
      print();
    });

    return () => { effect.destroy(); print.cancel(); for (const d of dispose) d?.(); form.destroy(); };
  },
};
