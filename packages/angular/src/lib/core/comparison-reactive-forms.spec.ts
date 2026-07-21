/**
 * Backs the side-by-side snippet in
 * `docs/guides/comparison-reactive-forms.md` — the same form built with
 * Reactive Forms and with @modyra/angular, asserted to behave equivalently.
 * Keeps the guide's code honest per the project's "no unverified snippets"
 * rule instead of a plausible-looking but untested pair of examples.
 */
import { FormControl, FormGroup, Validators } from "@angular/forms";
import {
  email as mdyEmail,
  required as mdyRequired,
} from "@modyra/core";
import { field, group, mdyForm } from "./typed-form";

describe("comparison-reactive-forms.md side-by-side snippet", () => {
  it("Reactive Forms: starts invalid (required+email), valid once filled", () => {
    const form = new FormGroup({
      email: new FormControl("", {
        nonNullable: true,
        validators: [Validators.required, Validators.email],
      }),
      address: new FormGroup({
        city: new FormControl("Rome", { nonNullable: true }),
      }),
    });

    expect(form.valid).toBe(false);
    expect(form.controls.email.errors).toEqual({ required: true });

    form.controls.email.setValue("a@b.co");
    expect(form.valid).toBe(true);
    expect(form.value).toEqual({ email: "a@b.co", address: { city: "Rome" } });
  });

  it("@modyra/angular: starts invalid (required+email), valid once filled", () => {
    const form = mdyForm({
      email: field("", [mdyRequired(), mdyEmail()]),
      address: group({ city: field("Rome") }),
    });

    expect(form.state.valid()).toBe(false);
    expect(form.f.email.errors().map((e) => e.message)).toEqual([
      "This field is required",
    ]);

    form.f.email.set("a@b.co");
    expect(form.state.valid()).toBe(true);
    expect(form.getValue()).toEqual({
      email: "a@b.co",
      address: { city: "Rome" },
    });
  });

  it("both APIs agree on the same invalid/valid transition for the same input", () => {
    const reactive = new FormGroup({
      email: new FormControl("", {
        nonNullable: true,
        validators: [Validators.required, Validators.email],
      }),
    });
    const modyra = mdyForm({ email: field("", [mdyRequired(), mdyEmail()]) });

    for (const input of ["", "not-an-email", "a@b.co"]) {
      reactive.controls.email.setValue(input);
      modyra.f.email.set(input);
      expect(modyra.state.valid()).toBe(reactive.valid);
    }
  });
});
