/**
 * Tree-shaking proof app.
 *
 * Imports ONLY the typed adapter surface. The bundle
 * check (`npm run test:bundle`) then asserts that no renderer, devtools,
 * wizard or dynamic-form code survives in the production output.
 */
import { Component, provideZonelessChangeDetection } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { field, mdyForm } from "@modyra/angular/adapter";
import { required as mdyRequired } from "@modyra/core";

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
