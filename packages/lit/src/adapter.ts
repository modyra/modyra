/**
 * @modyra/lit/adapter — headless Lit binding for the Modyra engine.
 *
 * Exposes the typed form factory and the ReactiveController bridge.
 * No custom elements are exported here.
 */
import {
    createForm,
    MdyBatchingCapability,
    MdyCoreFormOptions,
    MdyFlushCapability,
    MdyFormSchema,
    MdyFormValue,
    MdyObserveCapability,
    MdyReactivity,
    MdySignal,
    MdyTypedForm,
    vanillaReactivity,
} from "@modyra/core";

/**
 * `vanillaReactivity()` tagged `kind: "lit"` — same reasoning as
 * `@modyra/react`'s `reactReactivity()`: `createLitForm`/`MdyFormController`
 * already run on the vanilla graph by default, this just gives the
 * capability matrix (`scripts/reactivity-capability-matrix.mjs`) a named
 * export to introspect.
 */
export function litReactivity(): MdyReactivity &
    MdyBatchingCapability &
    MdyFlushCapability &
    MdyObserveCapability {
    return { ...vanillaReactivity(), kind: "lit" };
}

/** Structural subset of Lit's ReactiveControllerHost. */
export interface MdyControllerHost {
    addController(controller: {
        hostConnected?(): void;
        hostDisconnected?(): void;
    }): void;
    requestUpdate(): void;
}

/**
 * Re-renders the host whenever any of the tracked signals change.
 */
export class MdyFormController {
    private _ref: { destroy(): void } | null = null;
    private _first = true;

    constructor(
        private readonly _host: MdyControllerHost,
        private readonly _signals: ReadonlyArray<MdySignal<unknown>>,
    ) {
        _host.addController(this);
    }

    hostConnected(): void {
        if (this._ref) return;
        const rx = vanillaReactivity();
        this._first = true;
        this._ref = rx.effect(() => {
            for (const signal of this._signals) signal();
            if (this._first) {
                this._first = false;
                return;
            }
            this._host.requestUpdate();
        });
    }

    hostDisconnected(): void {
        this._ref?.destroy();
        this._ref = null;
    }
}

/** `createForm` on the vanilla graph — pair it with {@link MdyFormController}. */
export function createLitForm<S extends MdyFormSchema>(
    schema: S,
    options?: Omit<MdyCoreFormOptions<MdyFormValue<S>>, "reactivity">,
): MdyTypedForm<S> {
    return createForm(schema, { ...options, reactivity: vanillaReactivity() });
}

/**
 * Owns a form for the lifetime of a Lit element: creates it on construction
 * and destroys it (releasing async runners, draft/history effects and
 * timers) when the host leaves the DOM.
 *
 * Destruction is deferred by a microtask so that reparenting the element
 * (disconnect immediately followed by reconnect) does not tear the form
 * down. A destroyed form is not revived on reconnect — recreate the
 * element instead.
 *
 * ```ts
 * class MyForm extends LitElement {
 *   private _owner = new MdyOwnedForm(this, { email: field("", [required()]) });
 *   get form() { return this._owner.form; }
 * }
 * ```
 */
export class MdyOwnedForm<S extends MdyFormSchema> {
    readonly form: MdyTypedForm<S>;
    private _connected = false;

    constructor(
        host: MdyControllerHost,
        schema: S,
        options?: Omit<MdyCoreFormOptions<MdyFormValue<S>>, "reactivity">,
    ) {
        this.form = createLitForm(schema, options);
        host.addController(this);
    }

    hostConnected(): void {
        this._connected = true;
    }

    hostDisconnected(): void {
        this._connected = false;
        queueMicrotask(() => {
            if (!this._connected) this.form.destroy();
        });
    }
}

export * from "@modyra/core";
