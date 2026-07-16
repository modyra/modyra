import { DestroyRef, Directive, ElementRef, inject } from "@angular/core";
import { MdyTypedFormLike } from "../core/typed-form";
import { MdyFormComponent } from "../form/mdy-form.component";
import { MdyFormsDevtoolsService } from "./mdy-forms-devtools.service";

/**
 * Marks an `<mdy-form>` as inspectable by the devtools overlay:
 *
 * ```html
 * <mdy-form [form]="form" mdyDevtools>…</mdy-form>
 * ```
 *
 * Press the hotkey (default **Ctrl+Shift+D**, see `MDY_DEVTOOLS_HOTKEY`) to
 * toggle a draggable overlay inspecting the form that currently has focus
 * (fallback: the last registered form). Close it with ✕ or Escape.
 */
@Directive({
  selector: "mdy-form[mdyDevtools]",
  standalone: true,
})
export class MdyDevtoolsDirective {
  constructor() {
    const devtools = inject(MdyFormsDevtoolsService);
    const element = inject(ElementRef).nativeElement as HTMLElement;
    // MdyFormComponent structurally satisfies the devtools contract
    // (state/value/getField/fieldNames) whichever adapter is active.
    const form = inject(MdyFormComponent) as unknown as MdyTypedFormLike;
    devtools.register(element, form);
    inject(DestroyRef).onDestroy(() => devtools.unregister(element));
  }
}
