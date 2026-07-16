/**
 * Tree-shaking proof app.
 *
 * Imports ONLY the typed core from the primary entry point. The bundle
 * check (`npm run test:bundle`) then asserts that no renderer, devtools,
 * wizard or dynamic-form code survives in the production output.
 */
import { Component, provideZonelessChangeDetection } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { field, mdyForm, mdyRequired } from "@modyra/forms";

@Component({
  selector: "app-root",
  standalone: true,
  template: `{{ form.f.email.value() }} valid={{ form.state.valid() }}`,
})
class BundleTestComponent {
  readonly form = mdyForm({ email: field("a@b.co", [mdyRequired()]) });
}

void bootstrapApplication(BundleTestComponent, {
  providers: [provideZonelessChangeDetection()],
});
