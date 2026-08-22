/**
 * The page a browser battle attacks, rendered by `@modyra/angular`.
 *
 * Why this host exists: for months the browser tier had two renderers of three, and every question
 * about Angular's *rendered* behaviour could only be answered by reading its source. Finding 332 was
 * filed with Angular's half marked "unmeasured", and 333 with the same caveat — a gate gap found in
 * Angular that no browser check could confirm. The module tier packs the library and imports it; it
 * never puts a page in front of a browser, so geometry, paint order and pointer behaviour are outside
 * what it can see. That is the gap this closes.
 *
 * **This host authors no components.** The library's own `MdyDynamicFormComponent` is created directly
 * — the same component the demo writes as `<mdy-dynamic-form [fields]>` — through `createApplication`
 * and `createComponent`. Nothing here has a template, so nothing here can render differently from
 * what a consumer renders.
 *
 * **It does carry `@angular/compiler`, and that is a real difference worth stating.** Angular ships
 * its own packages in the Linker's partial form (`ɵɵngDeclareFactory`), and so does `ng-packagr` —
 * `modyra-angular.mjs` holds 40 `ngDeclareComponent` declarations. An application build runs the
 * Angular Linker over both; esbuild does not, so without the compiler present the page dies on
 * `_PlatformLocation` before Modyra is even reached.
 *
 * The consequence, honestly: components are compiled **in the page by JIT** rather than by the Linker
 * ahead of time. A template compiles to the same runtime instructions either way, so the rendered DOM,
 * its order and its geometry are the same — which is what this tier asks about. What it does *not*
 * reproduce is the build itself: a template error the Linker would refuse is reached here at runtime,
 * and AOT-only behaviour is out of scope. A spec that wants to make a claim about Angular's *build*
 * belongs in the module tier, which packs the library the way a consumer installs it.
 *
 * Running the Linker instead would need Babel and `@angular/compiler-cli` as a build dependency of
 * this tier. That is a dependency decision, not a test decision, and it is not taken here.
 *
 * **Zoneless**, because Angular 21's own default is zoneless and because a host running on zone.js
 * would hide precisely the class of defect that motivated this: a value that changes without the view
 * being told. If a control updates here, it updated because something signalled.
 *
 * It exposes the same operations as the Plain and Lit hosts where they mean the same thing, so a spec
 * can ask all three renderers the same question. Operations that have no Angular equivalent yet are
 * absent rather than faked — a host that answers a question it cannot really answer is worse than one
 * that refuses, because a spec cannot tell the difference.
 */
// Before anything that touches the framework: Angular and `ng-packagr` both ship partial-compiled
// output, and nothing in an esbuild bundle runs the Linker that would finish the job.
import "@angular/compiler";
import { createComponent, provideZonelessChangeDetection } from "@angular/core";
import { createApplication } from "@angular/platform-browser";
import { MdyDynamicFormComponent } from "@modyra/angular/ui";

const mounted = new Map();

const application = await createApplication({ providers: [provideZonelessChangeDetection()] });

/**
 * Let Angular settle before a spec looks.
 *
 * Zoneless change detection is scheduled, not synchronous, so reading the DOM in the same task as the
 * input that changed it reads the previous frame. Every operation here that changes something awaits
 * this, so a spec never has to know that.
 */
const settled = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

window.battleAngular = {
  /** Build a form over `fields` and render it, as `<mdy-dynamic-form [fields]>` does. */
  async mountFields(id, fields, options = {}) {
    const host = document.createElement("section");
    host.dataset.form = id;
    document.querySelector("#stage").append(host);
    try {
      const reference = createComponent(MdyDynamicFormComponent, {
        environmentInjector: application.injector,
        hostElement: host,
      });
      // Inputs before the view is attached, so the first render is the one under test rather than a
      // render of the defaults followed by a correction — the two are distinguishable in the DOM and
      // only the first is what a consumer's template produces.
      reference.setInput("fields", fields);
      if (options.idPrefix !== undefined && options.idPrefix !== null) {
        reference.setInput("idScope", String(options.idPrefix));
      }
      application.attachView(reference.hostView);
      const submitted = [];
      reference.instance.submitted?.subscribe?.((event) => submitted.push(event?.value ?? event));
      mounted.set(id, { reference, host, submitted });
      await settled();
      return { mounted: true, fields: fields.length };
    } catch (error) {
      return { mounted: false, message: String(error?.message ?? error) };
    }
  },

  /** The value the form holds, not the text the page is showing. */
  valueOf(id) {
    const entry = mounted.get(id);
    if (entry === undefined) return null;
    const form = entry.reference.instance.form?.();
    const value = form?.value?.();
    return value === undefined ? null : value;
  },

  /** Every value this form has handed to its submit action, in order. */
  submittedBy(id) {
    return mounted.get(id)?.submitted ?? [];
  },

  /**
   * Change the value from outside, the way an application does.
   *
   * The direction that is not driving the page: a value arriving from a fetch, a reset, a patch. A
   * control that does not follow it shows the user something the form no longer holds.
   */
  async setValue(id, patch) {
    const form = mounted.get(id)?.reference.instance.form?.();
    form?.adapter?.()?.patchValue?.(patch);
    await settled();
  },

  /** Give Angular a beat, for a spec that drove the page through the DOM rather than through here. */
  async settle() {
    await settled();
  },

  dispose(id) {
    const entry = mounted.get(id);
    if (entry === undefined) return;
    application.detachView(entry.reference.hostView);
    entry.reference.destroy();
    entry.host.remove();
    mounted.delete(id);
  },
};

window.battleAngularReady = true;
