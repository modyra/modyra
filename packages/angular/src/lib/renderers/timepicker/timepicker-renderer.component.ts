import { MdyPartDirective } from "../../control/mdy-part.directive";
import { NgTemplateOutlet } from "@angular/common";
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  effect,
  untracked,
  Injector,
  input,
} from "@angular/core";
import type { MdyTimeGranularity } from "@modyra/core";
import { MdyTimeFormat, buildTimeString, formatTimeAs, getCurrentTime, parseAnyTime } from "@modyra/core/datetime";
import {
  MDY_WIDGET_CONTRACTS,
  timeInputTransition,
  createTimepickerFieldController,
  type MdyTimepickerFieldIntent,
  overlayControlledId,
  projectOverlayOpenerA11y,
  MDY_TIMEPICKER_DEFAULT_FORMAT,
  MDY_TIMEPICKER_INITIAL_VIEW,
  type MdyTimepickerViewMode,
  timepickerPlaceholder,
  timepickerFieldPartIds,
} from "@modyra/widgets";
import { MdyWidgetRuntime, timepickerCommandElements } from "../../widget-runtime";
import { MdyErrorListComponent } from "../../control/error-list.component";
import { MdyControlLabelComponent } from "../../control/mdy-control-label.component";
import { MdyIconComponent } from "../../control/mdy-icon.component";
import { MDY_I18N_MESSAGES } from "../../core/i18n";
import { MdyOverlayControl, type MdyOverlayOwner } from "../../core/overlay-control.directive";
import { MdyOverlayPanelComponent } from "../../core/overlay-panel.component";
import { MdyTimepickerClockComponent } from "./timepicker-clock.component";

@Component({
  selector: "mdy-control-timepicker",
  standalone: true,
  imports: [MdyPartDirective, 
    NgTemplateOutlet,
    MdyControlLabelComponent,
    MdyErrorListComponent,
    MdyTimepickerClockComponent,
    MdyIconComponent,
    MdyOverlayPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './timepicker-renderer.component.scss',
  host: {
    "[class.mdy-floating-label]": "isFloatingLabel()",
    class: "mdy-renderer mdy-renderer--timepicker",
    "[class.mdy-renderer]": "widgetHasRootClass",
    "[class.mdy-inline-errors]": "inlineErrors",
    "[class.mdy-renderer--touched]": "touched()",
  },
  template: `
    <mdy-control-label
      [label]="label()"
      [forId]="fieldId"
      [hasError]="paintsAsInvalid()"
      [required]="isRequired()"
      [filled]="value() !== null"
      [showInlineError]="inlineErrorShown()"
      [errorText]="inlineErrorText()"
    />

    <div class="mdy-timepicker" #wrapper>
      <div [class]="wrapperClasses()">
        @if (prefix(); as p) {
           <div class="mdy-input-prefix">
             <ng-container [ngTemplateOutlet]="p.template" />
           </div>
        }
        <input
          #inputEl
          type="text"
          [id]="fieldId"
          class="mdy-timepicker__input"
          [mdyPart]="openerPart()"
          [value]="value() || ''"
          [disabled]="isDisabled()"
          [readonly]="isReadonly()"
          [placeholder]="effectivePlaceholder()"
          (change)="onInputChange($event)"
          (focus)="onInputFocus($event)"
          (blur)="onInputBlur($event)"
          (keydown)="openOnDeclaredKey($event)"
          (click)="openFromControl()"
          [attr.aria-invalid]="paintsAsInvalid()"
          [attr.aria-describedby]="describedById(fieldId)"
          [attr.aria-label]="controlAriaLabel()"
          [attr.aria-required]="ariaRequired() || isRequired()"
          [attr.aria-disabled]="effectiveAriaDisabled()"
          [attr.aria-readonly]="isReadonly() ? 'true' : null"
          autocomplete="off"
        />
        <div class="mdy-input-suffix">
          @if (suffix(); as s) {
            <ng-container [ngTemplateOutlet]="s.template" />
          } @else {
            <button
              type="button"
              class="mdy-timepicker__toggle"
              [disabled]="isDisabled()"
              [attr.aria-label]="i18n.timepickerOpenLabel"
              [mdyPart]="openerButtonPart()"
              tabindex="-1"
              (click)="toggleOverlay($event)"
            >
              <mdy-icon name="CLOCK" class="mdy-timepicker__icon" />
            </button>
          }
        </div>
      </div>

      <!-- The clock inside declares no dialog of its own, so this panel is the dialog and carries
           the name. A modal panel with no name is what axe reports as a dialog-name violation.
           The name is the field's label rather than the opener's words, which is the name the other
           renderers of this kind point at, and the draft the panel holds is kept only by confirming
           it — so the panel is modal wherever it is drawn, not only when it is drawn over the page. -->
      <mdy-overlay-panel
        [open]="open()"
        [position]="position()"
        [alignment]="alignment()"
        [coords]="coords()"
        [hasBackdrop]="position() === 'overlay'"
        [dialogLabelledBy]="labelId()"
        [modal]="true"
        [widthMode]="'auto-content'"
        [panelClass]="popupClass"
        [panelId]="popupId()"
        [kind]="'timepicker'"
        (close)="closeOverlay()"
      >
        <mdy-timepicker-clock
          [widgetId]="fieldId"
          [value]="draftValue()"
          [granularity]="granularity()"
          [readonly]="isReadonly()"
          [animateHand]="animateHand()"
          [showUnavailable]="showUnavailable()"
          [open]="open()"
          [format]="format()"
          [viewMode]="shownViewMode()"
          [focusedField]="shownField()"
          (focusedFieldChange)="send({ type: 'focus-field', field: $event })"
          (viewModeChange)="send({ type: 'set-view-mode', mode: $event })"
          [disabled]="isDisabled()"
          (timePicked)="onTimePicked($event)"
          (dialPicked)="onDialPicked($event)"
          (cancelClicked)="cancelPicker()"
          (confirmClicked)="confirmPicker()"
        />
      </mdy-overlay-panel>
    </div>

    @if (projectedSupportingText(); as st) {
      <div class="mdy-supporting-text" [id]="descriptionId(fieldId)">
        <ng-container [ngTemplateOutlet]="st.template" />
      </div>
    } @else if (supportingText(); as text) {
      <!-- The value route, for a field that declared its own words rather than
           projecting them. A document has no template to project. -->
      <div class="mdy-supporting-text" [id]="descriptionId(fieldId)">{{ text }}</div>
    }
    @if (errorsReserved()) {
      <mdy-error-list [fieldId]="fieldId" [errors]="errors()" />
    }
  `,
})
export class MdyTimepickerComponent extends MdyOverlayControl<string | null> {
  /* The popup wears what the catalogue says it wears, derived rather than restated. */
  protected readonly popupClass = MDY_WIDGET_CONTRACTS.timepicker.parts.popup.classes.join(" ");
  /** The widget this draws: its popup's room, width and edge come from the catalog. */
  protected override readonly overlayKind = "timepicker" as const;

  protected readonly widgetContract = MDY_WIDGET_CONTRACTS.timepicker;
  protected override readonly widgetKind = "timepicker" as const;
  protected readonly widgetHasRootClass = this.widgetContract.rootClasses.includes("mdy-renderer");
  protected readonly i18n = inject(MDY_I18N_MESSAGES);
  readonly placeholder = input<string>("");
  /**
   * Which clock this draws — the contract's default, not this component's. Pass `"12h"` for the
   * other; a default that differs between adapters renders one document two ways.
   */
  readonly format = input<MdyTimeFormat>(MDY_TIMEPICKER_DEFAULT_FORMAT);
  /** Which view the picker opens in, and returns to on close — the view the field has. */
  readonly viewMode = input<MdyTimepickerViewMode>(MDY_TIMEPICKER_INITIAL_VIEW);
  /**
   * Which times this field offers. Absent offers every one.
   *
   * The controller is told once, at construction, so a granularity that changes after the fact does
   * not silently rebuild the draft the user is editing.
   */
  readonly granularity = input<MdyTimeGranularity | undefined>(undefined);
  /** Whether the dial's hand moves rather than jumps. Off by default. */
  readonly animateHand = input<boolean>(false);
  /** Whether the dial shows which stretches of its ring carry no selectable time. Off by default. */
  readonly showUnavailable = input<boolean>(false);
  protected override readonly minSpace = 450;

  protected readonly effectivePlaceholder = computed(() =>
    this.placeholder() || timepickerPlaceholder(this.format()),
  );

  /**
   * The text this control could not read, said to the form.
   *
   * The field holds a value its own rules accept — `null`, which nothing objects to — while the
   * person is looking at text the widget could not parse. Unreported, the form was told nothing was
   * wrong and the submit went out empty where they had typed something.
   *
   * Reported to the form rather than painted from the controller's state, so the entry is one of the
   * field's errors like any other and goes through the rule that says a control out of play carries
   * no verdict.
   */
  protected readonly entryReported = effect(() => {
    // Read first, so this effect has a dependency before the controller exists: the controller is
    // built on a handle that arrives after the first change detection, and an effect that read
    // nothing on its first run never runs again.
    this.fieldState();
    const controller = this.controller();
    if (!controller) return;
    const unreadable = controller.state().entryUnreadable;
    untracked(() => this.reportEntry(unreadable ? this.i18n.entryUnreadable : null));
  });


  /** The id the opener names — the dialog, which is what carries the overlay's role. */
  protected readonly popupId = computed(() => overlayControlledId("timepicker", this.fieldId) ?? "");

  /** The label element the popup is named by — the field's own, which is on the page already. */
  protected readonly labelId = computed(() => timepickerFieldPartIds(this.fieldId).labelId);

  /** The relation between this widget's opener and the overlay it opens. */
  protected readonly openerPart = computed(
    () => projectOverlayOpenerA11y("timepicker", { widgetId: this.fieldId, open: this.open() })!,
  );
  /** The clock's draft, which the controller owns — this kind's value contract says `confirm`. */
  protected readonly controller = this.adoptFieldController((handle, widgetId) =>
    createTimepickerFieldController({
      widgetId,
      handle: handle as never,
      format: this.format(),
      viewMode: this.viewMode(),
      ...(this.granularity() !== undefined && { granularity: this.granularity()! }),
    }),
  );
  /** Which number the face is editing — the controller's, which hands it over when a drag ends. */
  protected readonly shownField = computed(() => this.controller()?.state().focusedField ?? "hour");

  /** Which view the popup is showing — the controller's, which restores the declared one on close. */
  protected readonly shownViewMode = computed(() => this.controller()?.state().viewMode ?? this.viewMode());

  protected readonly draftValue = computed(() => {
    const draft = this.controller()?.state().draft;
    return draft ? buildTimeString(draft.hour, draft.minute, draft.period) : getCurrentTime();
  });
  private readonly injector = inject(Injector);


  /** The controller's `open` is this kind's open state; see `MdyOverlayControl.overlayOwner`. */
  protected override overlayOwner(): MdyOverlayOwner | undefined {
    return this.controller() as MdyOverlayOwner | undefined;
  }

  private readonly widgetRuntime = inject(MdyWidgetRuntime);

  /**
   * Dispatches, and carries out what the controller asks of the DOM.
   *
   * `dispatch` returns commands — `focus`, `open-overlay`, `restore-focus` — and discarding them
   * leaves the controller's decisions unexecuted with nothing failing. The runtime applies them on
   * its own render beat.
   */
  protected send(intent: MdyTimepickerFieldIntent): void {
    const controller = this.controller();
    if (!controller) return;
    this.widgetRuntime.execute(
      controller.dispatch(intent),
      timepickerCommandElements(this.hostElement.nativeElement, this.format()),
      () => undefined,
      {
        setOpen: () => undefined,
        ...this.valueOwnerCallbacks(),
      },
    );
  }

  protected override onBeforeOpen(): void {
    this.send({ type: "open" });
  }

  /**
   * A position on the face, sent as the position it is.
   *
   * The angle and the ring travel; the controller owns what they mean. A face that reported a
   * formatted time instead would have to name it in some format, and only one of the two rings of a
   * 24-hour face has names the twelve-hour notation can write.
   */
  protected onDialPicked(pick: { field: "hour" | "minute"; angle: number; ring: "outer" | "inner"; phase?: "move" | "end" }): void {
    this.send({ type: "set-from-angle", ...pick });
  }

  /** A time chosen through the number fields or the period toggle — the controller reads it. */
  protected onTimePicked(time: string): void {
    this.send({ type: "set-time", time });
  }

  protected confirmPicker(): void { this.finishPicker("confirm"); }

  protected cancelPicker(): void { this.finishPicker("cancel"); }

  /** Both ways out of the popup: the controller decides what the draft becomes, the panel closes. */
  private finishPicker(how: "confirm" | "cancel"): void {
    this.send({ type: how });
    this.closeOverlay();
  }

  protected onInputChange(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const next = timeInputTransition(raw, (value) => {
      const parsed = parseAnyTime(value, this.format());
      return parsed ? formatTimeAs(parsed, this.format()) : null;
    });
    if (next !== undefined && next !== this.value()) {
      this.dispatchValueIntent<string | null>("timepicker", { type: "select", value: next });
    }
  }

  /**
   * Selects the text when there is nothing a person chose, so the first keystroke replaces it.
   *
   * Asked of the value rather than of the text: the resting display is whatever the format writes
   * midnight as, and a list of the strings it might be was a list of the twelve-hour ones — so on
   * the 24-hour clock, which is the default, the resting field was never selected.
   */
  protected onInputFocus(event: FocusEvent): void {
    const input = event.target as HTMLInputElement;
    if (!this.value()) afterNextRender(() => input.select(), { injector: this.injector });
  }

  /**
   * Leaving the field puts the control back in step with the value — unless there is no value.
   *
   * A time the field could not read is still what the person typed, and it is the only copy of it.
   * Replacing it with the empty string on the way out took their entry away and said nothing about
   * why, leaving a control that looks untouched and a person with nothing to correct. Held instead,
   * so the next keystroke edits what they wrote rather than starting again.
   */
  protected onInputBlur(event: FocusEvent): void {
    const input = event.target as HTMLInputElement;
    const held = this.value() || "";
    if (held !== "" || input.value === "") input.value = held;
    this.dispatchValueBlur("timepicker");
  }
}
