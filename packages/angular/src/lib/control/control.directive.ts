import {
  computed,
  contentChild,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  InputSignal,
  OnInit,
  Signal,
  signal,
  Injector,
  untracked,
} from "@angular/core";
import { MDY_DECLARATIVE_REGISTRY, MDY_FLOATING_LABELS, MDY_FORM_ADAPTER, MDY_INLINE_ERRORS } from "../core/tokens";
import { MdyFieldHandle } from "../core/typed-form";
import { angularReactivity } from "../core/reactivity-angular";
import { MdyFieldError, MdyFieldState, MdyFormAdapter } from "../core/types";
import { handleFormOf, NO_CONSTRAINTS, registerHandleOwner, type MdyFieldConstraints } from "@modyra/core";
import type { MdyInteractivity } from "@modyra/core";
import {
  createValueWidgetController,
  type MdyValueWidgetController,
  defaultWidgetIdFactory,
  narrowConstraints,
  projectFieldShellA11y,
  type MdyPartContract,
  type MdyValueWidgetIntent,
  type MdyWidgetKind,
} from "@modyra/widgets";

declare const ngDevMode: boolean | undefined;
import { MdyPrefixDirective } from "./prefix.directive";
import { MdySuffixDirective } from "./suffix.directive";
import { MdySupportingTextDirective } from "./supporting-text.directive";
import { errorsVisible, holdsUneditedValue, shownErrors, showsAsInvalid } from "@modyra/widgets";
import type { MdyValueKind } from "@modyra/core";

/** Global counter for generating unique field IDs. */
let _nextFieldId = 0;

/**
 * Abstract base class for all renderer components.
 *
 * Injects the nearest MdyFormAdapter (provided by MdyFormComponent)
 * and resolves the field state by name. Provides convenience computed
 * signals that concrete renderers bind in their templates.
 */
@Directive({
  host: {
    "[class.mdy-renderer--touched]": "touched()",
  },
})
export abstract class MdyBaseControl<TValue = unknown> implements OnInit {
  protected readonly hostElement = inject(ElementRef<HTMLElement>);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _injector = inject(Injector);
  private prefixObserver?: ResizeObserver;
  /** Field name currently claimed on the registry (tracks name changes). */
  private _claimedName: string | null = null;

  constructor() {
    this._destroyRef.onDestroy(() => {
      this.prefixObserver?.disconnect();
      if (this._claimedName !== null) {
        this._declarativeRegistry?.removeField(this._claimedName);
      }
    });
    // Create and claim the field in an effect (side effects belong here, not
    // in the fieldState computed — B8). Claim counting lets the adapter warn
    // on duplicate names and drop state only with the last owner (B9).
    effect(() => {
      const n = this.effectiveName();
      untracked(() => {
        if (this._claimedName === n) return;
        if (this._claimedName !== null) {
          this._declarativeRegistry?.removeField(this._claimedName);
          this._claimedName = null;
        }
        if (!n) {
          if (typeof ngDevMode !== "undefined" && ngDevMode) {
            console.warn(
              "[modyra] Control has neither a name attribute nor a [field] handle.",
            );
          }
          return;
        }
        this.adapter.getField(n);
        this._declarativeRegistry?.claimField(n);
        this._claimedName = n;
      });
    });
    effect(() => {
      const hasPrefix = !!this.prefix();
      const isFloating = this.isFloatingLabel();

      this.prefixObserver?.disconnect();

      if (hasPrefix && isFloating) {
        if (typeof requestAnimationFrame === "undefined") return; // SSR guard (R2)
        // Aspettiamo che il DOM venga aggiornato dal blocco @if (prefix())
        requestAnimationFrame(() => {
          const host = this.hostElement.nativeElement;
          const prefixEl = host.querySelector('.mdy-input-prefix') as HTMLElement;

          if (prefixEl && typeof ResizeObserver !== 'undefined') {
            this.prefixObserver = new ResizeObserver((entries) => {
              const target = entries[0]?.target as HTMLElement | undefined;
              if (target) {
                // Calcolo esatto perfetto (Larghezza reale nel DOM)
                const width = target.offsetWidth;
                // Impostiamo la variabile CSS sul componente host, delegando il gap al CSS
                host.style.setProperty('--mdy-label-left-offset', `calc(${width}px + var(--mdy-fl-input-padding-with-prefix, 0.75rem))`);
              }
            });
            this.prefixObserver.observe(prefixEl);
          }
        });
      } else {
        this.hostElement.nativeElement.style.removeProperty('--mdy-label-left-offset');
      }
    });
  }
  /**
   * Field name for declarative (`name`-based) mode.
   * Optional when a typed `[field]` handle is bound instead.
   */
  public readonly name: InputSignal<string> = input<string>("");

  /**
   * Typed field handle from an `mdyForm()` schema — the type-safe
   * alternative to the stringly `name` attribute:
   * `<mdy-control-text [field]="form.f.email" />`.
   * Accepts the nullable variant too: adapter fields start as `null`
   * (e.g. Zod-derived handles are `T | null`) and every renderer already
   * treats `null` as "empty". The control only reads the handle's path.
   */
  public readonly field = input<
    MdyFieldHandle<TValue> | MdyFieldHandle<TValue | null> | undefined
  >(undefined);

  /** Resolved adapter path: the handle's path or the `name` input. */
  protected readonly effectiveName: Signal<string> = computed(
    () => this.field()?.path ?? this.name(),
  );

  /**
   * Which form on the page this control belongs to, where a host renders more than one.
   *
   * Unset is the ordinary case. Set, it scopes every id this control publishes, so two forms built
   * from the same document do not both claim `when__label`. A single character neither part may
   * contain joins them, so two distinct scopes cannot produce one id.
   */
  public readonly idScope = input<string>("");

  /** What a control with no field falls back to. Not stable across mounts, because nothing about
   *  such a control is. */
  private readonly mountId = `mdy-control-${MdyBaseControl.nextId()}`;

  /**
   * The id every part of this control is built from.
   *
   * Derived from the field's own path (ADR 0135), so the same document renders the same ids every
   * time: a consumer can write `aria-describedby="when__label"` in their own markup, a stylesheet or
   * a test can name one, and server-rendered markup agrees with a client mount. A mount counter is a
   * property of what else was on the page first, and made every one of those a guess.
   *
   * Two fields called `when` on one page collide, visibly, and that is the better failure: two
   * counters never collide and never mean anything either. `idScope` is what a host with two forms
   * uses to keep them apart.
   */
  protected get fieldId(): string {
    const name = this.effectiveName();
    if (!name) return this.mountId;
    const scope = this.idScope();
    return scope ? `${scope}-${name}` : name;
  }

  /** The label text for the form control. */
  public readonly label = input<string>("");

  /**
   * The control's name when nothing visible carries it — a cell in a table, a control in a toolbar
   * whose column or icon says what it is to someone who can see it.
   *
   * Read only while `label` is empty. A visible label already names the control natively, and a
   * second name over the top of it is what makes the spoken name disagree with the written one.
   */
  public readonly ariaLabel = input<string | null>(null);

  /**
   * The name on the control element.
   *
   * The explicit one when it is given, otherwise the visible label's text. Naming the control from
   * the label as well as through `for` is redundant on paper and load-bearing in practice: the
   * label element also holds the required marker, so a name computed from its content carries an
   * asterisk the user's word does not — and anything matching on the name exactly, a test or an
   * assistive tool's find-by-name, then misses the control the user is asking for.
   */
  protected readonly controlAriaLabel: Signal<string | null> = computed(
    () => this.ariaLabel() || this.label() || null,
  );

  /** Opt-in or opt-out of floating labels on a per-control basis, overriding the form-level directive. */
  public readonly floatingLabel = input<boolean | undefined>(undefined);

  /**
   * Optional initial value for declarative mode.
   * Takes precedence over [formValue] set on the parent <mdy-form>.
   */
  readonly initialValue = input<unknown>(undefined);

  /**
   * The form this control writes into.
   *
   * Injected optionally so the failure can name the control. Without a form above it, Angular's own
   * error reports the missing token and nothing else — true, and useless in a template with thirty
   * controls in it, because the one that is outside is exactly the one it does not name.
   */
  private readonly _adapterOrNull = inject<MdyFormAdapter<Record<string, unknown>>>(
    MDY_FORM_ADAPTER,
    { optional: true },
  );

  private get adapter(): MdyFormAdapter<Record<string, unknown>> {
    if (this._adapterOrNull) return this._adapterOrNull;
    throw new Error(
      `[modyra] <${this.hostElement.nativeElement.tagName.toLowerCase()}>` +
      `${this._nameForError()} is outside a form. ` +
      "A control writes into the form that encloses it, so it must be a descendant of <mdy-form>; " +
      "a control rendered into an overlay or a dialog body is outside it unless the form element " +
      "wraps that too.",
    );
  }

  /** What identifies this control in a message, when it has said anything about which field it is. */
  private _nameForError(): string {
    const name = untracked(() => this.effectiveName());
    return name ? ` bound to "${name}"` : "";
  }

  private readonly _declarativeRegistry = inject(MDY_DECLARATIVE_REGISTRY, {
    optional: true,
  });

  /** True when MdyInlineErrorsDirective is applied to this element. */
  protected readonly inlineErrors: boolean =
    inject(MDY_INLINE_ERRORS, { self: true, optional: true }) ?? false;

  private readonly globalFloatingLabels = inject(MDY_FLOATING_LABELS, {
    optional: true,
  });

  /** Marks the field as required for assistive technology. */
  readonly ariaRequired = input<boolean>(false);

  /** Marks the field as disabled for assistive technology (auto-derived from field state). */
  readonly ariaDisabled = input<boolean | undefined>(undefined);


  /** Leading content (icon/text) provided via `mdyPrefix` directive. */
  protected readonly prefix = contentChild(MdyPrefixDirective);

  /** Trailing content (icon/text/button) provided via `mdySuffix` directive. */
  protected readonly suffix = contentChild(MdySuffixDirective);

  /** Supporting text (helper text) provided via `mdySupportingText` directive. */
  protected readonly projectedSupportingText = contentChild(MdySupportingTextDirective);

  /**
   * The line under the control, as a value rather than a projected template.
   *
   * Projection is how a hand-written host supplies it; this is how a **document** does. A field
   * declaring `supportingText` had no route to the slot in this adapter, so the words existed in the
   * contract and reached three renderers of four.
   */
  readonly supportingText = input<string | undefined>(undefined);

  /** Whether anything at all wants the description slot — either route. */
  protected readonly hasSupportingText = computed(
    () => !!this.projectedSupportingText() || !!this.supportingText(),
  );

  /**
   * Inert state served while `name`/`[field]` are still unresolved. Input
   * signals are not set during construction, so any computed chained to
   * {@link fieldState} (value, errors, …) must stay readable there instead
   * of throwing; the constructor effect reports controls that are STILL
   * unresolved after init. Per instance — never shared.
   */
  private _detachedState?: MdyFieldState<TValue>;

  private _detached(): MdyFieldState<TValue> {
    if (!this._detachedState) {
      const value = signal(null as TValue);
      const touched = signal(false);
      const dirty = signal(false);
      const off: Signal<boolean> = computed(() => false);
      const interactivity: Signal<MdyInteractivity> = computed(() => "enabled");
      this._detachedState = {
        interactivity,
        value,
        touched,
        dirty,
        required: off,
        // No field, so no rule to read a constraint from.
        constraints: computed(() => NO_CONSTRAINTS),
        valid: computed(() => true),
        errors: computed(() => []),
        disabled: off,
        readonly: off,
        pending: off,
      } as MdyFieldState<TValue>;
    }
    return this._detachedState;
  }

  /**
   * The form that built the bound handle, when it is one this library made and it is not the form
   * enclosing this control. `null` for a `name` binding, a hand-built handle, or the ordinary case
   * of a handle from the enclosing form.
   */
  private _formOfHandle(): MdyFormAdapter<Record<string, unknown>> | null {
    const handle = this.field();
    if (!handle) return null;
    const form = handleFormOf(handle as object);
    if (!form || form === this._adapterOrNull) return null;
    return form as MdyFormAdapter<Record<string, unknown>>;
  }

  /** Resolved field state — reactive to name/[field] changes. */
  protected readonly fieldState: Signal<MdyFieldState<TValue>> = computed(
    () => {
      const n = this.effectiveName();
      if (!n) {
        // Constructor-time read (inputs unresolved) or a control with
        // neither binding: stay inert, the init effect warns on the latter.
        return this._detached();
      }
      // A handle knows which form built it, and that is the form to read. `[field]` names a path,
      // and a path means nothing without its form: two forms on one page share every path they have
      // in common, so resolving against whichever form encloses the control sends what the user
      // types into the wrong one, silently. The enclosing form answers only for `name`.
      const source = this._formOfHandle() ?? this.adapter;
      const ref = source.getField(n);
      if (!ref) {
        // A path inside a keyed collection whose row has not been declared. The control renders
        // empty and binds when the row arrives; it must not be the thing that brings it into being,
        // which is why the adapter answers null rather than creating a field on the way past.
        //
        // Reading `fieldNames` is what makes "when the row arrives" happen: whether the path is
        // open is answered from the collection's own set, which a gate reads without touching a
        // signal, so nothing else here would ever re-ask. The dependency is taken only on the
        // branch that has no field — a bound control depends on its own state and not on every
        // registration in the form.
        source.fieldNames?.();
        return this._detached();
      }
      return ref() as MdyFieldState<TValue>;
    },
  );

  // ── Convenience signals for templates ───────────────────────────────────────

  public readonly value: Signal<TValue> = computed(() =>
    this.fieldState().value(),
  );
  /**
   * The errors this control shows — which is not always the errors the field holds.
   *
   * A field the form is not asking about carries no verdict on screen: the rule belongs to
   * `@modyra/widgets`, and everything below reads it from here, so the wrapper class, the label
   * state, `aria-invalid` and the error list cannot drift apart. The devtools panel deliberately
   * reads the field instead: a debugging view shows the model, not what the user is being asked.
   */
  protected readonly errors: Signal<ReadonlyArray<MdyFieldError>> = computed(() =>
    shownErrors({ disabled: this.isDisabled() }, this.fieldState().errors()),
  );
  protected readonly touched: Signal<boolean> = computed(() =>
    this.fieldState().touched(),
  );
  protected readonly dirty: Signal<boolean> = computed(() =>
    this.fieldState().dirty(),
  );
  protected readonly isDisabled: Signal<boolean> = computed(() =>
    this.fieldState().disabled(),
  );
  /**
   * Read but not written.
   *
   * Angular had no counterpart to `isDisabled`, so no template could bind the native attribute and
   * a field a form had marked read-only kept accepting typing. `dispatchValueIntent` already fed
   * `readonly` to the scalar controller, which meant the blocking half worked while the DOM said
   * nothing — the confusing state this closes.
   */
  protected readonly isReadonly: Signal<boolean> = computed(() =>
    this.fieldState().readonly(),
  );
  protected readonly isValid: Signal<boolean> = computed(() =>
    this.fieldState().valid(),
  );
  protected readonly hasErrors: Signal<boolean> = computed(
    () => this.errors().length > 0,
  );

  /**
   * Whether the control announces itself as failing — the one answer for `aria-invalid`.
   *
   * Named for the question because eight templates were answering it and one of them answered
   * differently: the colours field waited for `touched`, so a screen-reader user met a control the
   * form was rejecting and the control said nothing was wrong. The rule is the contract's
   * (`showsAsInvalid`: out of play, no verdict), and `errors()` already withholds the errors of a
   * field the form is not asking about — so a template that spells its own combination is a
   * template that can disagree with both.
   */
  protected readonly paintsAsInvalid: Signal<boolean> = computed(() =>
    showsAsInvalid({ valid: this.isValid(), disabled: this.isDisabled() }),
  );
  /** Effective aria-disabled: explicit input overrides field state. */
  protected readonly effectiveAriaDisabled: Signal<boolean> = computed(
    () => this.ariaDisabled() ?? this.isDisabled(),
  );

  /**
   * Whether the error list is actually in the DOM.
   *
   * The single condition every renderer template guards the list with, so that anything naming the
   * list — `aria-describedby` above all — cannot disagree with whether it was rendered. An invalid
   * but untouched field is the common case: it has errors and shows none.
   */
  protected readonly errorsRendered: Signal<boolean> = computed(
    () =>
      !this.inlineErrors &&
      errorsVisible(
        {
          disabled: this.isDisabled(),
          touched: this.touched(),
          // A value that arrived with the form and has not been edited since: a refusal about it is
          // about something already there, which nobody at this page can have caused by inaction.
          holdsUnedited: holdsUneditedValue(
            { value: this.value(), dirty: this.dirty() },
            this.widgetKind as MdyValueKind,
          ),
        },
        this.fieldState().errors(),
      ),
  );

  /**
   * The same question for a renderer that draws its error text beside the control rather than in a
   * list below it. One of the two is true at a time; both read the one rule, so a renderer cannot
   * show text the other would have hidden.
   */
  protected readonly inlineErrorShown: Signal<boolean> = computed(
    () =>
      this.inlineErrors &&
      errorsVisible(
        {
          disabled: this.isDisabled(),
          touched: this.touched(),
          // A value that arrived with the form and has not been edited since: a refusal about it is
          // about something already there, which nobody at this page can have caused by inaction.
          holdsUnedited: holdsUneditedValue(
            { value: this.value(), dirty: this.dirty() },
            this.widgetKind as MdyValueKind,
          ),
        },
        this.fieldState().errors(),
      ),
  );

  /**
   * The id the supporting-text element carries, or `null` when none is rendered.
   *
   * Bound as `[id]` on that element by every renderer that draws one. Without it the text is
   * rendered, styled, and announced to nobody: a description no reference can reach is invisible to
   * assistive technology however carefully it is worded.
   */
  protected descriptionId(fieldId: string): string | null {
    // Rendered in the branch the error list does not occupy, so the two are never both present.
    return !this.errorsRendered() && this.hasSupportingText()
      ? defaultWidgetIdFactory.part(fieldId, "description")
      : null;
  }

  /**
   * The id for `aria-describedby`, or `null` when there is nothing rendered to name.
   *
   * Takes the renderer's own `fieldId`, since each renderer mints one. The error list wins where
   * there is one, the supporting text answers otherwise, and a control with neither describes itself
   * by nothing — never by an id no element holds.
   */
  protected describedById(fieldId: string): string | null {
    // The shared factory, so this and the elements it names cannot spell the same relation two ways.
    if (this.errorsRendered()) return defaultWidgetIdFactory.part(fieldId, "errors");
    return this.descriptionId(fieldId);
  }

  /**
   * The semantic state of this control, as the shared contract projects it.
   *
   * A renderer binding `[mdyPart]="controlPart()"` receives `aria-invalid`, `aria-required`,
   * `aria-disabled` and `aria-describedby` from the shared projection, so no renderer decides for
   * itself which of a widget's states to expose.
   *
   * `errorsVisible` is answered here because the projection cannot know it: these renderers defer
   * the error list until the field is touched, so having errors is not the same as showing them.
   */
  protected readonly controlPart: Signal<MdyPartContract> = computed(() =>
    projectFieldShellA11y(
      {
        disabled: this.ariaDisabled() ?? this.isDisabled(),
        required: this.ariaRequired() || this.isRequired(),
        readonly: this.isReadonly(),
      },
      this.errors(),
      {
        widgetId: this.fieldId,
        // The kind decides which native constraints its control can carry, and the projection turns
        // the field's rules into those attributes — so a renderer binding this part offers them
        // without naming one, and a renderer that gains a constraint tomorrow needs no edit.
        kind: this.widgetKind,
        constraints: narrowConstraints(this.fieldState().constraints(), this.narrowedConstraints()),
        errorsVisible: this.errorsRendered(),
        // Supporting text is only emitted when a host projects some.
        descriptionVisible: this.hasSupportingText(),
      },
    ).control,
  );


  /**
   * The kind this renderer draws.
   *
   * The projection decides from it which native constraints the control can carry, so a renderer
   * that does not say leaves a slider claiming `maxlength` and offering no range. It was typed
   * `string` and defaulted to text, which is how nine renderers came to inherit an answer none of
   * them meant; the union is what makes a wrong one unspellable.
   */
  protected readonly widgetKind: MdyWidgetKind = "text";


  /**
   * What this renderer asks for on top of the field's rules — nothing, unless it has its own limits
   * to state. It cannot ask for more: the projection takes whichever end is tighter.
   */
  protected narrowedConstraints(): Partial<MdyFieldConstraints> {
    return {};
  }
  /** Whether the field is required (deduced from validators). */
  protected readonly isRequired: Signal<boolean> = computed(() =>
    this.fieldState().required(),
  );
  /** Error messages joined as a single string for inline display. */
  protected readonly inlineErrorText: Signal<string> = computed(() =>
    this.errors()
      .map((e: MdyFieldError) => e.message)
      .filter((msg) => !!msg && msg.trim() !== "")
      .join(", "),
  );

  /** Whether the field should display a floating label. */
  protected readonly isFloatingLabel: Signal<boolean> = computed(() => {
    const local = this.floatingLabel();
    if (local !== undefined) {
      return local;
    }
    return this.globalFloatingLabels?.mdyFloatingLabels() ?? false;
  });

  // ── Widgets scalar-controller bridge ───────────────────────────────────────

  private readonly _valueControllers = new Map<MdyWidgetKind, MdyValueWidgetController<unknown>>();

  /**
   * Sends scalar UI transitions through Widgets. Angular remains responsible
   * only for extracting the native DOM value and applying controller commands
   * to the form adapter.
   */
  protected dispatchValueIntent<T>(kind: MdyWidgetKind, intent: MdyValueWidgetIntent<T>): void {
    let controller = this._valueControllers.get(kind) as MdyValueWidgetController<T> | undefined;
    if (!controller) {
      controller = createValueWidgetController<T>({
        kind,
        value: this.value() as unknown as T,
        onChange: (next) => this.setValue(next as unknown as TValue),
      });
      this._valueControllers.set(kind, controller as MdyValueWidgetController<unknown>);
      this._destroyRef.onDestroy(() => controller?.destroy());
    }
    controller.setValue(this.value() as unknown as T);
    controller.setDisabled(this.isDisabled());
    controller.setReadonly(this.fieldState().readonly());
    controller.setInvalid(showsAsInvalid({ valid: this.isValid(), disabled: this.isDisabled() }));
    for (const command of controller.dispatch(intent)) {
      if (command.type === "mark-dirty") this.markAsDirty();
      if (command.type === "mark-touched") this.markAsTouched();
    }
  }

  /**
   * The kind's own controller, built the first time this renderer needs it.
   *
   * Deferred rather than built in `ngOnInit`, because a field initializer is an injection context
   * and `ngOnInit` is not — and because six renderers each writing the same lifecycle is the
   * duplication that adopting a shared controller was supposed to remove, not relocate.
   */
  protected adoptFieldController<TController extends { destroy(): void }>(
    create: (handle: MdyFieldHandle<TValue | null>, widgetId: string) => TController,
    sync?: (controller: TController) => void,
  ): () => TController | undefined {
    let controller: TController | undefined;
    let built = false;
    // Built outside any reactive context: the first read can come from a computed, and an effect
    // created inside one is a nested effect Angular refuses (NG0602). Nothing here should be a
    // dependency of the caller either — the controller is built once, not per recomputation.
    return () =>
      untracked(() => {
        if (built) return controller;
        const handle = this.controllerHandle();
        // Not built until there is a handle to build on. Latching before the check made the first
        // read the only one: a renderer whose template reads the controller during the first change
        // detection — before a name resolves to a field — cached `undefined` for the life of the
        // component, and every later interaction went nowhere.
        if (!handle) return undefined;
        built = true;
        controller = create(handle, this.fieldId);
        this._destroyRef.onDestroy(() => controller?.destroy());
        // What a reactive input feeds the controller — an option list, a pair of bounds. Told
        // rather than rebuilt: a fresh controller forgets the query, the roving focus and the month
        // on screen. The injector is passed because the first read is not an injection context.
        if (sync) effect(() => sync(controller as TController), { injector: this._injector });
        return controller;
      });
  }

  /**
   * A handle for the control to build its controller on, however the field was named.
   *
   * `[field]` hands one over. The `name` form does not — it resolves to the registry's state — and
   * for want of a handle every renderer kept a second way to commit its value, so the kind's
   * controller decided for one caller and the renderer decided for the other. The state carries
   * everything a handle exposes; what was missing was the shape, and the shape is written once.
   *
   * Registered against Angular's own runtime, because a controller resolves the runtime that owns
   * its handle: a synthetic one nobody claims would be observed by a vanilla runtime that cannot
   * see an Angular signal, and would render once and then never again.
   */
  private _syntheticHandle: MdyFieldHandle<TValue | null> | undefined;
  private controllerHandle(): MdyFieldHandle<TValue | null> | undefined {
    const bound = this.field();
    if (bound) return bound as MdyFieldHandle<TValue | null>;
    if (!this.effectiveName()) return undefined;
    if (!this._syntheticHandle) {
      const state = () => this.fieldState();
      const handle: MdyFieldHandle<TValue | null> = {
        get path() { return "" as string; },
        value: computed(() => state().value() as TValue | null),
        errors: computed(() => state().errors()),
        touched: computed(() => state().touched()),
        dirty: computed(() => state().dirty()),
        valid: computed(() => state().valid()),
        pending: computed(() => state().pending()),
        required: computed(() => state().required()),
        constraints: computed(() => state().constraints()),
        interactivity: computed(() => state().interactivity()),
        disabled: computed(() => state().disabled()),
        readonly: computed(() => state().readonly()),
        set: (value) => this.setValue(value as TValue),
        markAsTouched: () => this.markAsTouched(),
        markAsDirty: () => this.markAsDirty(),
        reportEntry: (problem: string | null) => this.reportEntry(problem),
      };
      // The *owner* registry, not the form one: `observerFor` reads this to decide which runtime a
      // controller should observe the handle through. Registered in the wrong one, the controller
      // fell back to a vanilla runtime whose signals an Angular computed cannot see — so its state
      // changed and nothing re-rendered, which is the failure this registry exists to prevent.
      registerHandleOwner(handle, angularReactivity(this._injector));
      this._syntheticHandle = handle;
    }
    return this._syntheticHandle;
  }

  protected dispatchValueBlur(kind: MdyWidgetKind): void {
    this.dispatchValueIntent(kind, { type: "blur" });
  }

  /**
   * The touched and dirty callbacks a widget runtime takes, answered by the owner of the value.
   *
   * A renderer that answers them itself has taken a decision the controller exists to make, and the
   * next renderer will not take it the same way. The runtime asks; this is who it reaches.
   */
  protected valueOwnerCallbacks(): { readonly onTouched: () => void; readonly onDirty: () => void } {
    return { onTouched: () => this.markAsTouched(), onDirty: () => this.markAsDirty() };
  }

  /** Applies non-user synchronization without dirty/touched side effects. */
  protected synchronizeValue(value: TValue): void {
    this.setValue(value);
  }

  // ── Mutation helpers ────────────────────────────────────────────────────────

  public setValue(newValue: TValue): void {
    this.fieldState().value.set(newValue);
  }

  protected markAsTouched(): void {
    this.fieldState().touched.set(true);
  }

  protected markAsDirty(): void {
    this.fieldState().dirty.set(true);
  }

  /**
   * An entry the control could not read, said to the form.
   *
   * Resolved against the same form the state came from — a path means nothing without its form —
   * and silently ignored when the control is not bound, which is the state a detached control is in
   * before its name resolves.
   */
  protected reportEntry(problem: string | null): void {
    const name = this.effectiveName();
    if (!name) return;
    const source = this._formOfHandle() ?? this.adapter;
    source.reportEntry(name, problem);
  }

  /** Generate a unique ID for template label/input association. */
  protected static nextId(): number {
    return _nextFieldId++;
  }

  ngOnInit(): void {
    const iv = this.initialValue();
    const n = this.effectiveName();
    if (this._declarativeRegistry && iv !== undefined && n) {
      this._declarativeRegistry.setInitialValue(n, iv);
    }
  }


}
