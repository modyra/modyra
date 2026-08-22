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
import { createComponent, ErrorHandler, provideZonelessChangeDetection } from "@angular/core";
import { createApplication } from "@angular/platform-browser";
import { MdyDynamicFormComponent } from "@modyra/angular/ui";
import { parseDynamicForm } from "@modyra/core";
import { createMdyAnnouncer } from "@modyra/widgets";
import { announceThrough, documentProbes } from "./document-probes.mjs";

const mounted = new Map();

/**
 * Whatever the application threw and Angular caught, since the last mount.
 *
 * **A guard that throws inside change detection does not reach `attachView`.** Angular routes it to
 * the `ErrorHandler` and carries on, so a mount whose form refused every field returned
 * `{ mounted: true }` from here and a spec read an empty page as a renderer drawing nothing. That is
 * the "looks like it did it" shape — the same one this host's `setValue` wore this morning, from the
 * other side.
 *
 * Collected rather than rethrown: rethrowing here would break Angular's own recovery and change what
 * the page does, and this host exists to watch a page rather than to change one.
 */
const caught = [];

const application = await createApplication({
  providers: [
    provideZonelessChangeDetection(),
    { provide: ErrorHandler, useValue: { handleError: (error) => caught.push(String(error?.message ?? error)) } },
  ],
});

/**
 * Let Angular settle before a spec looks.
 *
 * Zoneless change detection is scheduled, not synchronous, so reading the DOM in the same task as the
 * input that changed it reads the previous frame. Every operation here that changes something awaits
 * this, so a spec never has to know that.
 */
const settled = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

window.battleAngular = {
  // What the page says about itself: dangling references, duplicate ids, where focus is, how many
  // controls the stage holds. No adapter appears in any of them, so all three hosts answer alike.
  ...documentProbes,

  /** Build a form over `fields` and render it, as `<mdy-dynamic-form [fields]>` does. */
  async mountFields(id, fields, options = {}) {
    const since = caught.length;
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
      // A refusal that reached the ErrorHandler instead of this `try` is still a refusal, and a
      // mount that says it succeeded over an empty page is worse than one that says it failed.
      if (caught.length > since) {
        const message = caught[caught.length - 1];
        mounted.delete(id);
        host.remove();
        return { mounted: false, message };
      }
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
    // `patchValue` on the form itself, which is what the other two hosts call and what this one
    // reaches through `form()`. It used to go `form.adapter().patchValue(...)`, and every link in
    // that chain was optional — so when `adapter` turned out not to be there, the write did nothing
    // and said nothing. A spec then read a value that had never been set and reported the renderer
    // as ignoring it: the premise failed and the finding was attributed to the wrong component.
    if (typeof form?.patchValue !== "function") {
      throw new Error("[battle] the angular form exposes no patchValue, so setValue cannot write");
    }
    form.patchValue(patch);
    await settled();
  },

  /**
   * The form-level doors the other two hosts have had all along.
   *
   * This host published six methods where the plain one publishes twenty-six, and **every one of the
   * twenty missing is called by some spec**. That is the reason sixty-nine of a hundred and
   * forty-one browser specs keep a host list with no Angular in it: not a decision anyone took, but a
   * host that could not do what they needed, so the renderer was left out one file at a time and the
   * suite went quiet about it.
   *
   * Each one reaches the same place the other hosts reach — the running form — and each mutation
   * awaits a frame, because this renderer schedules its change detection instead of running it. A
   * spec that read the DOM in the same task as the write would read the previous frame, which is the
   * shape every Angular defect in this suite has worn at least once.
   */
  async readonly(id, path) {
    mounted.get(id)?.reference.instance.form?.()?.setReadonly?.(path, () => true);
    await settled();
  },

  async disable(id, path) {
    mounted.get(id)?.reference.instance.form?.()?.setDisabled?.(path, () => true);
    await settled();
  },

  async reset(id) {
    mounted.get(id)?.reference.instance.form?.()?.reset?.();
    await settled();
  },

  /** What the engine says is wrong with one field, and whether the form may be sent. */
  errorsOf(id, path) {
    return mounted.get(id)?.reference.instance.form?.()?.errorsFor?.(path)?.() ?? [];
  },

  canSubmitOf(id) {
    return mounted.get(id)?.reference.instance.form?.()?.state?.canSubmit?.() ?? null;
  },

  submittingOf(id) {
    return mounted.get(id)?.reference.instance.form?.()?.state?.submitting?.() ?? null;
  },

  /**
   * End the form and leave the controls in the document.
   *
   * The window a framework opens between destroying its model and removing its nodes: an element
   * still holds a handle to a form that has ended, and whatever a person does in that window reaches
   * it.
   */
  destroyFormOnly(id) {
    mounted.get(id)?.reference.instance.form?.()?.destroy?.();
  },

  /**
   * Mount, and remember the answer this form's submission is to be given.
   *
   * The plain door takes an `onSubmit` at mount time; this component takes none, so the answer is
   * held here and applied when `submit` runs. **That is the faithful translation rather than a
   * lesser one**: what the specs using this assert is what a page does with a refusal, and a
   * refusal arriving at submit time is the same refusal. Inventing a mount-time handler the
   * component does not have would be the host describing an API that is not there.
   *
   * **One observable difference, stated rather than hidden.** The plain host's `submit` installs a
   * handler of its own that returns nothing, so it *bypasses* the answer its own `mountWithSubmit`
   * was given — press the button there and the refusal arrives, call `submit` and it does not. This
   * host honours the answer either way. A spec widened to run here that depends on the bypass will
   * see the difference, and the difference is plain's quirk rather than this host's invention.
   */
  async mountWithSubmit(id, fields, errors) {
    const result = await this.mountFields(id, fields);
    const entry = mounted.get(id);
    if (entry !== undefined) entry.answer = errors;
    return result;
  },

  /** The same, with the answer arriving after a wait, so a spec can ask what the page shows meanwhile. */
  async mountSlowSubmit(id, fields, ms, errors = null) {
    const result = await this.mountFields(id, fields);
    const entry = mounted.get(id);
    if (entry !== undefined) { entry.answer = errors; entry.answerAfter = ms; }
    return result;
  },

  /**
   * Mount a form the way an application mounts one that arrived as data.
   *
   * Through the contract's own door: the envelope is parsed, and a refusal is answered with the
   * diagnostics rather than with an empty form, because a document the contract will not carry is a
   * different outcome from one it carries badly.
   */
  async mountDocument(id, envelope, options = {}) {
    const parsed = parseDynamicForm(envelope, { mode: options.mode ?? "strict" });
    if (!parsed.ok) {
      return {
        mounted: false,
        diagnostics: parsed.diagnostics.map((each) => ({ code: each.code, path: each.path, message: each.message })),
      };
    }
    const result = await this.mountFields(id, parsed.fields, options);
    return result.mounted === false
      ? result
      : { mounted: true, accepted: parsed.acceptedCount, rejected: parsed.rejectedCount };
  },

  /**
   * Sending, and what a page does with the answer.
   *
   * The three the submission specs need. Each drives the running form rather than pressing a button:
   * whether the page *offers* to send is a separate question with its own specs, and mixing the two
   * makes a failure to send indistinguishable from a failure to ask.
   */
  async submit(id) {
    const entry = mounted.get(id);
    const form = entry?.reference.instance.form?.();
    await form?.submit?.(async (value) => {
      entry.submitted.push(structuredClone(value));
      // An answer a mount asked to be given, and the wait it asked for. Absent both, a submission
      // that succeeds silently, which is what a bare submit means.
      if (entry.answerAfter !== undefined) {
        await new Promise((resolve) => setTimeout(resolve, entry.answerAfter));
      }
      return entry.answer ?? null;
    });
    await settled();
    return entry?.submitted.length ?? 0;
  },

  async submitAnswering(id, answer) {
    const entry = mounted.get(id);
    const form = entry?.reference.instance.form?.();
    await form?.submit?.((value) => {
      entry.submitted.push(structuredClone(value));
      // A thrown answer is how a spec asks what a page does when the server does not reply with a
      // refusal but with a failure.
      if (answer !== null && typeof answer === "object" && answer.__throw !== undefined) {
        throw new Error(String(answer.__throw));
      }
      return answer;
    });
    await settled();
  },

  lastSubmitErrorsOf(id) {
    const errors = mounted.get(id)?.reference.instance.form?.()?.state?.lastSubmitErrors?.() ?? [];
    return errors.map((entry) => ({
      path: entry.path ?? null,
      message: typeof entry.message === "string" ? entry.message : String(entry.message),
    }));
  },

  /** A published widget helper that needs only a region and a sentence. */
  announce: announceThrough(createMdyAnnouncer),

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
