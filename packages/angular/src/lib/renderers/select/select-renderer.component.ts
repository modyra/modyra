import { MdyPartDirective } from "../../control/mdy-part.directive";
import { NgClass, NgTemplateOutlet } from "@angular/common";
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  forwardRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from "@angular/core";
import { filterOptionsByQuery } from "@modyra/core/ui";
import { MDY_OVERLAY_PORTAL_CLASS } from "@modyra/widgets";
import { MDY_WIDGET_CONTRACTS, createTypeahead, isTypeaheadCharacter, popupAlignmentClass, popupPlacementClass, optionsWithUnrecognizedValue, reconcileSelectValue, selectKeyboardAction, typeaheadMatch, overlayControlledId, projectOverlayOpenerA11y } from "@modyra/widgets";
import { MdyBaseControl } from "../../control/control.directive";
import { MdyErrorListComponent } from "../../control/error-list.component";
import { MdyControlLabelComponent } from "../../control/mdy-control-label.component";
import { MdyIconComponent } from "../../control/mdy-icon.component";
import { MdyGlassDirective } from "../../core/directives/glass.directive";
import { MdyOverlayPanelComponent } from "../../core/overlay-panel.component";
import { MDY_OPTIONS_CONTROL } from "../../core/tokens";
import { MdyOptionsControl, MdySelectOption } from "../../core/types";
import { MdyAngularSelectAdapter, MdyWidgetRuntime } from "../../widget-runtime";
import { MdyDropdownBase } from "../dropdown-base";

@Component({
  selector: "mdy-control-select",
  standalone: true,
  imports: [MdyPartDirective, NgClass,
    NgTemplateOutlet,
    MdyControlLabelComponent,
    MdyErrorListComponent,
    MdyIconComponent,
    MdyGlassDirective,
    MdyOverlayPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: MDY_OPTIONS_CONTROL,
      useExisting: forwardRef(() => MdySelectComponent),
    },
  ],
  host: {
    "[class.mdy-floating-label]": "isFloatingLabel()",
    class: "mdy-renderer mdy-renderer--select",
    "[class.mdy-renderer]": "widgetHasRootClass",
    "[class.mdy-inline-errors]": "inlineErrors",
    "[class.mdy-renderer--touched]": "touched()",
    "(keydown)": "onKeydown($event)",
  },
  template: `
    <mdy-control-label
      [label]="label()"
      [forId]="fieldId"
      [required]="isRequired()"
      [filled]="value() !== null"
      [showInlineError]="inlineErrorShown()"
      [errorText]="inlineErrorText()"
    />

    @if (optionTpl() || searchable()) {
      <!-- Custom dropdown -->
      <div class="mdy-select" #wrapper>
        <div class="mdy-input-wrapper" [class.mdy-input-wrapper--disabled]="isDisabled()">
          @if (prefix(); as p) {
            <div class="mdy-input-prefix">
              <ng-container [ngTemplateOutlet]="p.template" />
            </div>
          }
          <button
            type="button"
            class="mdy-select__trigger"
            [mdyPart]="openerPart()"
            [id]="fieldId"
            [disabled]="isDisabled()"
            [attr.aria-expanded]="open()"
            [attr.aria-haspopup]="'listbox'"
            [attr.aria-activedescendant]="
              activeIndex() >= 0 ? fieldId + '-opt-' + activeIndex() : null
            "
            [attr.aria-invalid]="hasErrors()"
            [attr.aria-describedby]="describedById(fieldId)"
            [attr.aria-label]="controlAriaLabel()"
            [attr.aria-required]="ariaRequired() || isRequired()"
            [attr.aria-disabled]="effectiveAriaDisabled()"
                (click)="toggleOverlay($event)"
            (blur)="onBlur($event)"
          >
            @if (selectedOption(); as sel) {
              <span class="mdy-select__value">
                @if (optionTpl(); as tpl) {
                  <ng-container
                    [ngTemplateOutlet]="tpl"
                    [ngTemplateOutletContext]="{ $implicit: sel, selected: true }"
                  />
                } @else {
                  {{ sel.label }}
                }
              </span>
            } @else {
              <span class="mdy-select__placeholder">{{ placeholder() || '&nbsp;' }}</span>
            }
          </button>
          @if (effectiveLoading()) {
            <mdy-icon name="LOADER" class="mdy-select__loader" />
          } @else {
            <mdy-icon
              name="CHEVRON_DOWN"
              class="mdy-select__arrow"
              [class.mdy-select__arrow--open]="open()"
            />
          }
          @if (suffix(); as s) {
            <div class="mdy-input-suffix">
              <ng-container [ngTemplateOutlet]="s.template" />
            </div>
          }
        </div>

        <mdy-overlay-panel
          [open]="open()"
          [position]="position()"
          [alignment]="alignment()"
          [coords]="coords()"
          [hasBackdrop]="overlayMode()"
          [widthMode]="widthMode()"
          (close)="closeOverlay()"
        >
          <div
            mdyGlass
            [class]="popupClass"
            [ngClass]="placementClass()"
          >
            @if (searchable()) {
              <input
                #searchInput
                type="text"
                class="mdy-select__search"
                [placeholder]="i18n.searchPlaceholder"
                autocomplete="off"
                [value]="searchQuery()"
                (input)="onSearchInput($event)"
              />
            }
            <ul
              class="mdy-select__list"
              [id]="popupId()"
              role="listbox"
              [attr.aria-labelledby]="fieldId"
            >
              @for (opt of filteredOptions(); track opt.value; let i = $index) {
                <li
                  [id]="fieldId + '-opt-' + i"
                  role="option"
                  class="mdy-select__option"
                  [class.mdy-select__option--active]="activeIndex() === i"
                  [class.mdy-select__option--selected]="opt.value == value()"
                  [attr.aria-selected]="opt.value == value()"
                  (click)="selectOption(opt)"
                >
                  @if (optionTpl(); as tpl) {
                    <ng-container
                      [ngTemplateOutlet]="tpl"
                      [ngTemplateOutletContext]="{
                        $implicit: opt,
                        selected: opt.value == value()
                      }"
                    />
                  } @else {
                    <span class="mdy-select__option-label">{{ opt.label }}</span>
                  }
                </li>
              }
              @if (showCreateOption()) {
                <li
                  class="mdy-select__option mdy-select__option--create"
                  role="option"
                  [attr.aria-selected]="false"
                  (click)="onCreateOption()"
                >
                  {{ i18n.selectCreateOption(searchQuery().trim()) }}
                </li>
              }
              @if (filteredOptions().length === 0 && !showCreateOption()) {
                <li class="mdy-select__no-results" role="presentation">
                  @if (effectiveLoading()) {
                    <div class="mdy-select__loading-content">
                      <mdy-icon name="LOADER" class="mdy-select__loader" />
                      <span>{{ loadingText() || i18n.loading }}</span>
                    </div>
                  } @else {
                    {{ i18n.noResults }}
                  }
                </li>
              }
            </ul>
          </div>
        </mdy-overlay-panel>
      </div>
    } @else {
      <!-- Native select fallback -->
      <div class="mdy-input-wrapper" [class.mdy-input-wrapper--disabled]="isDisabled()">
         @if (prefix(); as p) {
            <div class="mdy-input-prefix">
              <ng-container [ngTemplateOutlet]="p.template" />
            </div>
          }
          <select
            [id]="fieldId"
            [value]="value() ?? ''"
            [disabled]="isDisabled()"
            (change)="onNativeChange($event)"
            (blur)="markAsTouched()"
            [attr.aria-invalid]="hasErrors()"
            [attr.aria-describedby]="describedById(fieldId)"
            [attr.aria-label]="controlAriaLabel()"
            [attr.aria-required]="ariaRequired() || isRequired()"
            [attr.aria-disabled]="effectiveAriaDisabled()"
                [style.opacity]="(value() === null || value() === undefined) ? '0.6' : '1'"
          >
            @if (placeholder() || value() === null || value() === undefined) {
              <option value="" disabled [selected]="value() === null || value() === undefined">
                {{ placeholder() || ' ' }}
              </option>
            }
            @for (opt of renderedOptions(); track opt.value) {
              <option [value]="opt.value" [selected]="opt.value == value()">
                {{ opt.label }}
              </option>
            }
          </select>
            <mdy-icon name="CHEVRON_DOWN" class="mdy-select__arrow" />
          @if (suffix(); as s) {
            <div class="mdy-input-suffix">
              <ng-container [ngTemplateOutlet]="s.template" />
            </div>
          }
      </div>
    }

    @if (errorsRendered()) {
      <mdy-error-list [fieldId]="fieldId" [errors]="errors()" />
    } @else if (supportingText(); as st) {
      <div class="mdy-supporting-text" [id]="descriptionId(fieldId)">
        <ng-container [ngTemplateOutlet]="st.template" />
      </div>
    }
  `,
})
export class MdySelectComponent<TValue = string>
  extends MdyDropdownBase<TValue | null, TValue>
  implements MdyOptionsControl<TValue> {
  /* The popup wears what the catalogue says it wears. Restated in the template, a class added
     to the contract reached the renderers that derive and stopped at this one. */
  protected readonly popupClass = MDY_WIDGET_CONTRACTS.select.parts.popup.classes.join(" ") + " " + MDY_OVERLAY_PORTAL_CLASS;
  /** The widget this draws: its popup's room, width and edge come from the catalog. */
  protected override readonly overlayKind = "select" as const;

  protected readonly widgetContract = MDY_WIDGET_CONTRACTS.select;
  protected readonly widgetHasRootClass = this.widgetContract.rootClasses.includes("mdy-renderer");
  readonly placeholder = input<string>("");
  readonly disabled = input<boolean>(false);
  readonly allowCreate = input(false, { transform: booleanAttribute });
  readonly optionCreated = output<string>();
  public override readonly isDisabled = computed(() => this.disabled() || this.fieldState().disabled());
  private readonly runtime = inject(MdyWidgetRuntime);
  private selectAdapter!: MdyAngularSelectAdapter<TValue>;
  private readonly parkedValue = signal<TValue | null>(null);

  /**
   * What this select renders: its options, plus the value the model holds when the list does not
   * contain it. The value is not erased to make the widget consistent, so it has to be visible —
   * otherwise the control looks empty while the form holds something, and a validation message
   * refers to a value nobody can see.
   */
  protected readonly renderedOptions = computed(() =>
    // The same answer the controller reaches, computed here because the template needs it before
    // the adapter has been fed this change-detection round. The rule itself lives in the helper,
    // once, for every renderer of this contract.
    optionsWithUnrecognizedValue(this.effectiveOptions(), this.value()),
  );

  constructor() {
    super();

    this.selectAdapter = new MdyAngularSelectAdapter<TValue>(
      {
        widgetId: this.fieldId,
        options: [],
        value: null,
        disabled: false,
        readonly: false,
        invalid: false,
        loading: false,
        onChange: (value: TValue | null) => {
          if (value !== this.value()) {
            this.dispatchValueIntent<TValue | null>("select", { type: "select", value });
            const opt = this.optionFor(value);
            if (opt) this.selectionChange.emit(opt);
          }
        },
      },
      this.runtime,
      this.injector,
    );

    this.selectAdapter.connectHandlers({
      setOpen: (open) => open ? this.openOverlay() : this.closeOverlay(),
      onChange: () => undefined,
      onTouched: () => this.dispatchValueBlur("select"),
      onDirty: () => undefined,
    });

    effect(() => {
      this.selectAdapter.setOptions(this.renderedOptions());
      this.selectAdapter.setValue(this.value());
      this.selectAdapter.setDisabled(this.isDisabled());
      this.selectAdapter.setReadonly(this.fieldState().readonly());
      this.selectAdapter.setInvalid(this.hasErrors());
      this.selectAdapter.setLoading(this.effectiveLoading());
    }, { injector: this.injector });

    effect(() => {
      const current = { value: this.value(), parkedValue: this.parkedValue() };
      const next = reconcileSelectValue(current, this.effectiveOptions());
      untracked(() => {
        if (next.parkedValue !== current.parkedValue) this.parkedValue.set(next.parkedValue);
        if (next.value !== current.value) this.synchronizeValue(next.value);
      });
    }, { injector: this.injector });
  }

  protected readonly fieldId = `mdy-control-select-${MdyBaseControl.nextId()}`;

  /** The id the opener names — the listbox, which is what carries the overlay's role. */
  protected readonly popupId = computed(() => overlayControlledId("select", this.fieldId) ?? "");

  /** The relation between this widget's opener and the overlay it opens. */
  protected readonly openerPart = computed(
    () => projectOverlayOpenerA11y("select", { widgetId: this.fieldId, open: this.open() })!,
  );

  protected readonly dropUp = computed(() => this.position() === "above");

  /**
   * Which side the list ended up on, named by the catalog rather than spelled here.
   *
   * `above` and `overlay` are declared states of the select's `popup` part, so the class comes from
   * `popupPlacementClass` — the call every renderer makes. `right` is a declared state too, and
   * the binding below still spells it: deriving it here means threading the alignment through the
   * same call, which is a change to that helper rather than to this component.
   */
  /**
   * Where the popup ended up, both halves from the contract.
   *
   * Both halves are asked for rather than spelled. Writing `mdy-select__dropdown--right` by hand
   * would duplicate the catalog's own spelling — correct and unauditable at the same time, since
   * nothing then connects the class to the contract that declares it.
   */
  protected readonly placementClass = computed(() => [
    popupPlacementClass("select", this.position()),
    popupAlignmentClass("select", this.alignment()),
  ].filter((name): name is string => name !== null).join(" "));

  protected readonly overlayMode = computed(
    () => this.position() === "overlay",
  );

  protected readonly activeIndex = computed(() => {
    const key = this.selectAdapter.state().activeKey;
    if (key === null) return -1;
    return this.filteredOptions().findIndex((o) => this.optionKey(o.value) === key);
  });

  protected readonly selectedOption = computed<MdySelectOption<TValue> | null>(
    () => {
      const v = this.value();
      if (v === null || v === undefined) return null;
      return this.optionFor(v) ?? null;
    },
  );

  protected readonly filteredOptions = computed(() =>
    filterOptionsByQuery(this.renderedOptions(), this.selectAdapter.state().query),
  );

  protected readonly showCreateOption = computed(() => {
    if (!this.allowCreate() || !this.searchable()) return false;
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) return false;
    return !this.effectiveOptions().some(
      (o) => o.label.trim().toLowerCase() === query,
    );
  });

  protected onCreateOption(): void {
    const query = this.searchQuery().trim();
    if (!query) return;
    this.optionCreated.emit(query);
    this.closeOverlay();
  }

  private readonly searchInputRef =
    viewChild<ElementRef<HTMLInputElement>>("searchInput");

  protected override openOverlay(event?: Event): void {
    super.openOverlay(event);
    this.selectAdapter.setOpen(true);
  }

  public override closeOverlay(): void {
    super.closeOverlay();
    this.selectAdapter.setOpen(false);
  }

  protected override onBeforeOpen(): void {
    super.onBeforeOpen();

    if (this.searchable()) {
      afterNextRender(() => this.searchInputRef()?.nativeElement.focus(), { injector: this.injector });
    }
  }

  protected selectOption(opt: MdySelectOption<TValue>): void {
    this.selectAdapter.dispatch({ type: "select", optionKey: this.optionKey(opt.value) });
    this.closeOverlay();
  }

  /**
   * Focus leaving the widget closes it — `capabilities.dismissOnFocusOutside`.
   *
   * It never outranks a pointer. A drag that began inside the popup moves focus out of it on the
   * way, and closing there would reinstate, through the focus path, exactly the dismissal
   * `dismissOnOutsidePointer` refuses. `touched` still marks: the user has been here either way.
   */
  protected onBlur(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (next && this.wrapperRef()?.nativeElement.contains(next)) return;
    if (!MDY_WIDGET_CONTRACTS.select.capabilities.dismissOnFocusOutside) return;
    if (this.interactionFromInside()) {
      this.markAsTouched();
      return;
    }
    this.selectAdapter.dispatch({ type: "blur" });
  }

  /**
   * The typeahead, held per component rather than per keystroke.
   *
   * A buffer rebuilt each key is not a buffer: this is what accumulates a word across events, and
   * what its idle timeout expires when the user stops.
   */
  private readonly typeahead = createTypeahead();

  protected onKeydown(event: KeyboardEvent): void {
    // A listbox jumps rather than filters. Handled before the keyboard policy, which has no rule for
    // a printable character and would otherwise let it fall through to nothing — which is what left
    // this renderer's non-searchable select silent to a typing user.
    if (!this.searchable() && this.open() && isTypeaheadCharacter(event.key, event)) {
      const match = typeaheadMatch(this.options(), this.typeahead.push(event.key));
      if (match) {
        event.preventDefault();
        this.selectAdapter.dispatch({ type: "activate", optionKey: String(match.value) });
      }
      return;
    }

    const action = selectKeyboardAction({
      key: event.key,
      open: this.open(),
      searchFocused: this.searchInputRef()?.nativeElement === document.activeElement,
      activeKey: this.selectAdapter.state().activeKey,
      createAvailable: this.showCreateOption(),
    });
    if (!action) return;
    // Tab keeps its native meaning: the list closes and the browser carries focus to the next
    // control. Cancelling it leaves the user standing in a panel that is being torn down, and the
    // overlay's focus rescue then pulls them back into the field they were trying to leave.
    if (event.key !== "Tab") event.preventDefault();
    if (action.type === "create") {
      this.onCreateOption();
      return;
    }
    if (action.type === "open") {
      this.openOverlay();
      return;
    }
    // No compensation here. `ArrowDown` on a closed list is answered by the contract with `open`,
    // and this renderer used to open on a `move` it could not perform — which meant the keyboard
    // worked while the policy that describes it was wrong, and a regression in the contract stayed
    // invisible from the outside.
    this.selectAdapter.dispatch(action);
  }

  protected override onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
    this.searchChanged.emit(value);
    this.selectAdapter.dispatch({ type: "search", query: value });
  }

  public resetSelection(): void {
    this.selectAdapter.setValue(null);
    this.dispatchValueIntent<TValue | null>("select", { type: "select", value: null });
  }

  protected onNativeChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const stringValue = target.value;
    const matched = this.optionFor(stringValue);
    const value = matched?.value ?? null;
    this.dispatchValueIntent<TValue | null>("select", { type: "select", value });
    if (matched) this.selectionChange.emit(matched);
  }
}
