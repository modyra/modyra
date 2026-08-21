import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  Injector,
  input,
  output,
  Signal,
  untracked,
  viewChild,
} from "@angular/core";
import { applyDynamicRules, applyFlatValidators, parseDynamicForm } from "@modyra/core";
import {
  mdyEmptyValueFor,
  MdyDynamicField,
  MdyDynamicDiagnostic,
  MdyDynamicLayoutChild,
  MdyDynamicLayoutNode,
  MdyDynamicLayoutSlot,
  MdyDynamicParseMode,
  MdyTimeGranularity,
  MdyTimepickerViewMode,
  MdySignal,
} from "@modyra/core";
import type { MdyTimeFormat } from "@modyra/core/datetime";
import { layoutNodeAttributes, layoutSlotStyle, MDY_LAYOUT_CLASSES, MDY_TIMEPICKER_DEFAULT_FORMAT, MDY_TIMEPICKER_INITIAL_VIEW } from "@modyra/widgets";
import { angularReactivity } from "../core/reactivity-angular";
import { MdyFormSubmitEvent } from "../core/types";
import { MdyFormComponent } from "../form/mdy-form.component";
import { MdyCheckboxComponent } from "../renderers/checkbox/checkbox-renderer.component";
import { MdyDatePickerComponent } from "../renderers/datepicker/datepicker.component";
import { MdyMultiselectComponent } from "../renderers/multiselect/multiselect-renderer.component";
import { MdyNumberComponent } from "../renderers/number/number-renderer.component";
import { MdyRadioGroupComponent } from "../renderers/radio/radio-group-renderer.component";
import { MdySegmentedButtonComponent } from "../renderers/segmented-button/segmented-button-renderer.component";
import { MdySelectComponent } from "../renderers/select/select-renderer.component";
import { MdySliderComponent } from "../renderers/slider/slider-renderer.component";
import { MdyTextComponent } from "../renderers/text/text-renderer.component";
import { MdyTextareaComponent } from "../renderers/textarea/textarea-renderer.component";
import { MdyTimepickerComponent } from "../renderers/timepicker";
import { MdyToggleComponent } from "../renderers/toggle/toggle-renderer.component";

/**
 * Runtime form rendering from a serializable config — CMS, form builders,
 * low-code scenarios. The config is a discriminated union
 * ({@link MdyDynamicField}), so invalid kind/property combinations do not
 * compile when the config is authored in TypeScript, and validators are a
 * JSON-safe subset mapped to the library's pure validator functions.
 *
 * ```ts
 * readonly fields: MdyDynamicField[] = [
 *   { kind: "text", name: "firstName", label: "First name", validators: { required: true } },
 *   { kind: "select", name: "country", label: "Country", options: [...] },
 *   { kind: "slider", name: "budget", label: "Budget", min: 0, max: 100 },
 * ];
 * ```
 * ```html
 * <mdy-dynamic-form [fields]="fields" (submitted)="save($event)" />
 * ```
 */
@Component({
  selector: "mdy-dynamic-form",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The form root is named the same in every renderer — the framework-free renderer has always added this class
  // to its container. It is what the foundation makes a layout container, so a row asks how wide the
  // *form* is rather than how wide the window is; a custom element is inline by default and would
  // carry no layout box to contain.
  host: { class: "mdy-dynamic-form", style: "display: block" },
  imports: [
    MdyFormComponent,
    MdyTextComponent,
    MdyTextareaComponent,
    MdyNumberComponent,
    MdySliderComponent,
    MdyCheckboxComponent,
    MdyToggleComponent,
    MdySelectComponent,
    MdyRadioGroupComponent,
    MdyMultiselectComponent,
    MdySegmentedButtonComponent,
    MdyDatePickerComponent,
    MdyTimepickerComponent,
    NgTemplateOutlet,
  ],
  template: `
    <mdy-form #form (submitted)="submitted.emit($event)">
      <!-- Declarative layout when the form declares one, otherwise the fields in order.
           Either way each field is rendered by one template, so the two paths cannot drift. -->
      @if (renderedLayout().length > 0) {
        @for (node of renderedLayout(); track node.id) {
          <ng-container *ngTemplateOutlet="layoutNode; context: { $implicit: node }" />
        }
        @for (f of unplacedFields(); track f.name) {
          <ng-container *ngTemplateOutlet="fieldTemplate; context: { $implicit: f }" />
        }
      } @else {
        @for (f of renderedFields(); track f.name) {
          <ng-container *ngTemplateOutlet="fieldTemplate; context: { $implicit: f }" />
        }
      }
      <ng-content />

      <!-- A layout node holds fields or further nodes, so the template calls itself. -->
      <ng-template #layoutNode let-node>
        @if (node.kind === "section") {
          <fieldset [class]="layoutClasses.section" [attr.data-layout-id]="node.id">
            @if (node.label) {
              <legend [class]="layoutClasses.sectionLabel">{{ node.label }}</legend>
            }
            @for (child of node.children; track $index) {
              <ng-container *ngTemplateOutlet="layoutChild; context: { $implicit: child }" />
            }
          </fieldset>
        } @else {
          <div
            [class]="layoutClasses.columns"
            [style]="columnRowStyle(node)"
            [attr.data-layout-id]="node.id"
          >
            @for (column of node.columns; track $index) {
              <div [class]="layoutClasses.column" [style]="columnStyle(column)">
                @for (child of column; track $index) {
                  <ng-container *ngTemplateOutlet="layoutChild; context: { $implicit: child }" />
                }
              </div>
            }
          </div>
        }
      </ng-template>

      <ng-template #layoutChild let-child>
        @if (fieldNameOf(child); as name) {
          @if (fieldByName(name); as f) {
            <ng-container *ngTemplateOutlet="fieldTemplate; context: { $implicit: f }" />
          }
        } @else {
          <ng-container *ngTemplateOutlet="layoutNode; context: { $implicit: child }" />
        }
      </ng-template>

      <ng-template #fieldTemplate let-f>

          @switch (f.kind) {
            @case ("text") {
              <mdy-control-text
                [name]="f.name"
                [label]="f.label ?? ''"
                [placeholder]="f.placeholder ?? ''"
                [initialValue]="emptyFor(f)"
              />
            }
            @case ("email") {
              <mdy-control-text
                type="email"
                [name]="f.name"
                [label]="f.label ?? ''"
                [placeholder]="f.placeholder ?? ''"
                [initialValue]="emptyFor(f)"
              />
            }
            @case ("password") {
              <mdy-control-text
                type="password"
                [name]="f.name"
                [label]="f.label ?? ''"
                [placeholder]="f.placeholder ?? ''"
                [initialValue]="emptyFor(f)"
              />
            }
            @case ("textarea") {
              <mdy-control-textarea
                [name]="f.name"
                [label]="f.label ?? ''"
                [placeholder]="f.placeholder ?? ''"
                [initialValue]="emptyFor(f)"
              />
            }
            @case ("number") {
              <mdy-control-number
                [name]="f.name"
                [label]="f.label ?? ''"
                [placeholder]="f.placeholder ?? ''"
                [minValue]="f.min ?? null"
                [maxValue]="f.max ?? null"
                [step]="f.step ?? 1"
                [initialValue]="emptyFor(f)"
              />
            }
            @case ("slider") {
              <mdy-control-slider
                [name]="f.name"
                [label]="f.label ?? ''"
                [min]="f.min ?? 0"
                [max]="f.max ?? 100"
                [step]="f.step ?? 1"
                [initialValue]="emptyFor(f)"
              />
            }
            @case ("checkbox") {
              <mdy-control-checkbox
                [name]="f.name"
                [label]="f.label ?? ''"
                [initialValue]="emptyFor(f)"
              />
            }
            @case ("toggle") {
              <mdy-control-toggle
                [name]="f.name"
                [label]="f.label ?? ''"
                [initialValue]="emptyFor(f)"
              />
            }
            @case ("select") {
              <mdy-control-select
                [name]="f.name"
                [label]="f.label ?? ''"
                [placeholder]="f.placeholder ?? ''"
                [options]="f.options"
                [initialValue]="emptyFor(f)"
              />
            }
            @case ("radio") {
              <mdy-control-radio
                [name]="f.name"
                [label]="f.label ?? ''"
                [options]="f.options"
                [initialValue]="emptyFor(f)"
              />
            }
            @case ("multiselect") {
              <!-- What the document says about this field, forwarded. A member the document
                   declares and this template drops is a capability nobody can reach. -->
              <mdy-control-multiselect
                [name]="f.name"
                [label]="f.label ?? ''"
                [options]="f.options"
                [initialValue]="emptyFor(f)"
                [searchable]="asOptions(f).searchable ?? false"
                [reorderable]="asOptions(f).reorderable ?? false"
              />
            }
            @case ("segmented") {
              <mdy-control-segmented
                [name]="f.name"
                [label]="f.label ?? ''"
                [options]="f.options"
                [initialValue]="emptyFor(f)"
              />
            }
            @case ("datepicker") {
              <mdy-control-datepicker
                [name]="f.name"
                [label]="f.label ?? ''"
                [initialValue]="emptyFor(f)"
              />
            }
            @case ("timepicker") {
              <!-- A document declaring which clock it draws, which times it offers, and how the
                   dial says so. Without these the properties parse, validate and reach no control:
                   a capability a document can ask for and no renderer hears. -->
              <mdy-control-timepicker
                [name]="f.name"
                [label]="f.label ?? ''"
                [initialValue]="emptyFor(f)"
                [format]="asTime(f).format ?? defaultFormat"
                [viewMode]="asTime(f).viewMode ?? initialView"
                [granularity]="asTime(f).granularity"
                [animateHand]="asTime(f).animateHand ?? false"
                [showUnavailable]="asTime(f).showUnavailable ?? false"
              />
            }
          }
      </ng-template>
    </mdy-form>

  `,
})
export class MdyDynamicFormComponent {
  /* What a timepicker draws when the document says nothing — the contract's answers, not this
     component's. A fallback written as a literal here is a fifth copy of a default the contract
     owns, and the one furthest from anything that would notice it drifting. */
  protected readonly defaultFormat = MDY_TIMEPICKER_DEFAULT_FORMAT;
  protected readonly initialView = MDY_TIMEPICKER_INITIAL_VIEW;

  /** An options field's own members, read from the union the template narrows by `kind`. */
  protected asOptions(field: MdyDynamicField): { readonly searchable?: boolean; readonly reorderable?: boolean } {
    return field as { searchable?: boolean; reorderable?: boolean };
  }

  /** A timepicker's own members, read from the union the template narrows by `kind`. */
  protected asTime(field: MdyDynamicField): {
    readonly format?: MdyTimeFormat;
    readonly viewMode?: MdyTimepickerViewMode;
    readonly granularity?: MdyTimeGranularity;
    readonly animateHand?: boolean;
    readonly showUnavailable?: boolean;
  } {
    return field as { format?: MdyTimeFormat; viewMode?: MdyTimepickerViewMode; granularity?: MdyTimeGranularity; animateHand?: boolean; showUnavailable?: boolean };
  }

  /**
   * Serializable field configs, rendered in order.
   *
   * Optional because {@link MdyDynamicFormComponent.document} is the other way in. One of the two is
   * given; a component handed neither renders nothing, which is what an empty list already meant.
   */
  readonly fields = input<ReadonlyArray<MdyDynamicField>>([]);

  /**
   * A document as it arrived — from a server, a CMS, a model — read by this component.
   *
   * The component is named for the dynamic contract and took only the *parsed* half of it, so a host
   * rendering one server document on this adapter and another wrote the parse step twice, with the
   * strict-mode diagnostics and the refusal of a partial form as the part most easily forgotten.
   *
   * Untrusted by construction: it is parsed here, and in strict mode a document carrying any error
   * renders nothing rather than the part of itself that happened to be well formed. The diagnostics
   * are emitted either way, so a host can show them.
   */
  readonly document = input<unknown>(null);

  /** How the document is read. `strict` refuses a document with any error; `lenient` renders what parsed. */
  readonly parseMode = input<MdyDynamicParseMode>("strict");

  /** What reading {@link MdyDynamicFormComponent.document} found, emitted whenever the document changes. */
  readonly diagnostics = output<ReadonlyArray<MdyDynamicDiagnostic>>();

  /**
   * The document, read — or `null` when none was given and the pre-parsed inputs are the source.
   *
   * A computed rather than an effect: the fields and the layout are two readings of one parse, and
   * parsing once per read of each would answer two different documents for one input.
   */
  protected readonly parsed = computed(() => {
    const document = this.document();
    if (document === null || document === undefined) return null;
    return parseDynamicForm(document, { mode: this.parseMode() });
  });

  /** What is rendered: the document's fields when there is one, the input's otherwise. */
  protected readonly renderedFields = computed<ReadonlyArray<MdyDynamicField>>(() => {
    const parsed = this.parsed();
    if (parsed === null) return this.fields();
    return parsed.ok || this.parseMode() === "lenient" ? parsed.fields : [];
  });

  /** The layout the same way, so a document that is refused arranges nothing either. */
  protected readonly renderedLayout = computed<ReadonlyArray<MdyDynamicLayoutNode>>(() => {
    const parsed = this.parsed();
    if (parsed === null) return this.layout();
    return parsed.ok || this.parseMode() === "lenient" ? parsed.layout : [];
  });

  /**
   * What a field starts as when the config names no initial value.
   *
   * The answer is the contract's, not this template's: spelling it per kind here made a third table
   * beside the one the rule reads, and the three did not agree.
   */
  protected emptyFor(field: MdyDynamicField): unknown {
    return mdyEmptyValueFor(field);
  }

  /**
   * Contract v2 layout: sections and column rows, nestable. Fields the layout names render inside
   * it; anything it does not mention still renders, after — a partial layout arranges the part it
   * describes rather than hiding the rest.
   */
  readonly layout = input<ReadonlyArray<MdyDynamicLayoutNode>>([]);

  /** The class vocabulary is the contract's, so every adapter draws the same grid. */
  protected readonly layoutClasses = MDY_LAYOUT_CLASSES;

  /** Fields no layout node claims, rendered after the arranged ones. */
  protected readonly unplacedFields = computed(() => {
    const claimed = new Set<string>();
    const walk = (child: MdyDynamicLayoutChild): void => {
      if (typeof child === "string") { claimed.add(child); return; }
      if ("ref" in child) { claimed.add(child.ref); return; }
      if (child.kind === "section") child.children.forEach(walk);
      else child.columns.forEach((column) => column.forEach(walk));
    };
    this.renderedLayout().forEach(walk);
    return this.renderedFields().filter((field) => !claimed.has(field.name));
  });

  /**
   * The field a slot names, or `null` when the child is a nested layout node.
   *
   * A bare string and a v3 `{ ref }` slot name a field the same way; the slot merely also says where
   * it sits. Answering with the name rather than a type guard keeps the template to one branch for
   * both spellings, which is what stops the two drifting apart.
   */
  protected fieldNameOf(child: MdyDynamicLayoutChild): string | null {
    if (typeof child === "string") return child;
    return "ref" in child ? child.ref : null;
  }

  /**
   * A column's own placement, from the first child inside it that asks for one.
   *
   * A slot and a section answer the same way: a section occupying a column is a column like any
   * other, which is how a group in a row is laid out for a screen size.
   */
  protected columnStyle(column: ReadonlyArray<MdyDynamicLayoutChild>): Record<string, string> {
    for (const child of column) {
      if (typeof child === "string") continue;
      const at = "ref" in child ? (child as MdyDynamicLayoutSlot).at : child.kind === "section" ? child.at : undefined;
      if (at) return { ...layoutSlotStyle(at) };
    }
    return {};
  }

  protected fieldByName(name: string): MdyDynamicField | undefined {
    return this.renderedFields().find((field) => field.name === name);
  }

  /** The track count the foundation divides a column row by. */
  protected columnRowStyle(node: MdyDynamicLayoutNode): Record<string, string> {
    return layoutNodeAttributes(node).style;
  }

  /** Re-emitted from the inner `<mdy-form>`. */
  readonly submitted = output<MdyFormSubmitEvent<Record<string, unknown>>>();

  /** Inner form — exposed so consumers can call getValue()/reset()/submit(). */
  readonly form = viewChild.required<MdyFormComponent<Record<string, unknown>>>("form");

  private readonly _injector = inject(Injector);

  constructor() {
    // Register the config validators on the inner form's registry; keyed by
    // field so config changes replace the previous set.
    effect(() => {
      const fields = this.renderedFields();
      const form = this.form();
      // The engine's own, under this binding's key. Written out here it was a fourth copy of a rule
      // that lives upstream — including the automatic option whitelist that stops a tampered
      // document from widening a select's accepted values.
      untracked(() => { applyFlatValidators(form, fields, "mdy-dynamic"); });
    });

    // The third step of the document path, and the one a host most easily forgets: a document's
    // cross-field rules decide what is shown and what is out of play, and a form built from the
    // fields alone renders every one of them always.
    effect(() => {
      const parsed = this.parsed();
      const form = this.form();
      if (parsed === null) return;
      untracked(() => {
        // The host the rules are written against, assembled from what the form component already
        // publishes plus the runtime its signals are built with — a condition tracked by a different
        // runtime is one that never re-evaluates.
        applyDynamicRules({
          reactivity: angularReactivity(this._injector),
          value: form.value as MdySignal<Record<string, unknown>>,
          setInactive: (name, inactive) => form.setInactive(name, inactive as Signal<boolean>),
          setDisabled: (name, disabled) => form.setDisabled(name, disabled as Signal<boolean>),
        }, parsed.rules);
      });
    });

    // Emitted from an effect rather than computed into one: a diagnostic is something that happened
    // to a document, and a host listening for it is told once per document rather than once per read.
    effect(() => {
      const parsed = this.parsed();
      if (parsed === null) return;
      untracked(() => { this.diagnostics.emit(parsed.diagnostics); });
    });
  }
}
