import { vanillaReactivity } from "./reactivity.js";
import { MdyFormEngine, } from "./form-engine.js";
import { MDY_MARKS_REQUIRED } from "./validators.js";
/** Declares a typed leaf field of a {@link createForm} schema. */
export function field(initial, validators = [], options) {
    return {
        kind: "field",
        initial: initial,
        validators,
        asyncValidators: options?.asyncValidators ?? [],
        asyncDebounceMs: options?.asyncDebounceMs ?? 0,
    };
}
/** Declares a nested group of fields (`address.city` paths on the engine). */
export function group(children) {
    return { kind: "group", children };
}
/**
 * Creates a typed, reactive form model from a schema — the framework-free
 * heart of Modyra. Runs anywhere JavaScript runs:
 *
 * ```ts
 * const form = createForm({
 *   email: field("", [required(), email()]),
 *   address: group({ city: field("Rome") }),
 * });
 *
 * form.f.email.set("foo@bar.com");
 * form.f.email.errors();   // []
 * form.getValue().address.city; // "Rome" — typos do not compile
 * ```
 */
export function createForm(schema, options) {
    return new MdyTypedForm(schema, options);
}
// ─── Typed form ───────────────────────────────────────────────────────────────
/** Owner key for validators registered from the schema. */
const SCHEMA_KEY = "mdy-schema";
/**
 * Typed form model over the flat {@link MdyFormEngine}.
 *
 * Implements `MdyFormAdapter` (with the nested, inferred value type) and
 * `MdyFormRegistry`, so bindings that speak the flat path protocol keep
 * working next to the typed handle tree.
 */
export class MdyTypedForm {
    _engine;
    /** Leaf paths in schema order. */
    _leafPaths;
    /** Group prefixes — used to flatten nested patches. */
    _groupPaths;
    /** Typed handle tree mirroring the schema (`form.f.address.city`). */
    f;
    state;
    value;
    constructor(schema, options) {
        const rx = options?.reactivity ?? vanillaReactivity();
        this._engine = new MdyFormEngine(rx, () => undefined, () => options?.submitMode ?? "valid-only");
        const leafPaths = [];
        const groupPaths = new Set();
        this._registerSchema(schema, "", leafPaths, groupPaths);
        this._leafPaths = leafPaths;
        this._groupPaths = groupPaths;
        const history = options?.history;
        if (history === true) {
            this._engine.enableHistory();
        }
        else if (history) {
            this._engine.enableHistory(history);
        }
        const draft = options?.draft;
        if (typeof draft === "string") {
            this._engine.enableDraft({ key: draft });
        }
        else if (draft) {
            this._engine.enableDraft(draft);
        }
        const formValidators = options?.validators ?? [];
        if (formValidators.length > 0) {
            // Cross-field validators see the nested typed value; the errors they
            // return use the same dotted paths the flat engine stores fields under.
            this._engine.setFormValidators(formValidators.map((fn) => (flat) => fn(this._unflatten(flat))));
        }
        // The cast is the single typed/stringly boundary: the tree is built to
        // mirror the schema shape walked above.
        this.f = this._buildHandleTree(schema, "");
        this.state = this._engine.state;
        this.value = rx.computed(() => this._unflatten(this._engine.value()));
    }
    // ── MdyFormAdapter ──────────────────────────────────────────────────────────
    getValue() {
        return this._unflatten(this._engine.getValue());
    }
    getField(name) {
        return this._engine.getField(name);
    }
    errorsFor(path) {
        return this._engine.errorsFor(String(path));
    }
    async submit(action) {
        return this._engine.submit((flat) => action(this._unflatten(flat)));
    }
    markAllTouched() {
        this._engine.markAllTouched();
    }
    buildSubmitEvent(value) {
        return {
            value,
            valid: this.state.valid(),
            errors: [...this.state.lastSubmitErrors()],
        };
    }
    patchValue(partial) {
        this._engine.patchValue(this._flattenPatch(partial));
    }
    /** Deeply-typed variant of {@link patchValue} for nested groups. */
    patch(partial) {
        this._engine.patchValue(this._flattenPatch(partial));
    }
    setValue(value) {
        const flat = {};
        for (const path of this._leafPaths) {
            flat[path] = this._pathGet(value, path);
        }
        this._engine.setValue(flat);
    }
    reset() {
        this._engine.reset();
    }
    // ── History and change tracking ─────────────────────────────────────────────
    /** True when {@link undo} has state to restore (requires `history` option). */
    get canUndo() {
        return this._engine.canUndo;
    }
    /** True when {@link redo} has state to restore. */
    get canRedo() {
        return this._engine.canRedo;
    }
    /** Restores the previous recorded form value. */
    undo() {
        this._engine.undo();
    }
    /** Re-applies the value undone by the last {@link undo}. */
    redo() {
        this._engine.redo();
    }
    /**
     * Minimal nested patch: only the fields whose value differs from the
     * schema's initial values — ready for an API PATCH request.
     */
    getChanges() {
        return this._unflatten(this._engine.getChanges());
    }
    /** Reactive flat field paths (dotted for groups) — devtools/inspection. */
    get fieldNames() {
        return this._engine.fieldNames;
    }
    /** True when a stored draft was restored (requires the `draft` option). */
    get hasDraft() {
        return this._engine.hasDraft;
    }
    /** Removes the stored draft (also happens after an error-free submit). */
    clearDraft() {
        this._engine.clearDraft();
    }
    // ── MdyFormRegistry (bindings speaking the flat path protocol) ──────────────
    addValidators(name, validators, isRequired) {
        this._engine.addValidators(name, validators, isRequired);
    }
    upsertValidators(name, key, validators, marksRequired) {
        this._engine.upsertValidators(name, key, validators, marksRequired);
    }
    removeValidators(name, key) {
        this._engine.removeValidators(name, key);
    }
    upsertAsyncValidators(name, key, validators, options) {
        this._engine.upsertAsyncValidators(name, key, validators, options);
    }
    setInitialValue(name, value) {
        this._engine.setInitialValue(name, value);
    }
    setDisabled(name, disabled) {
        this._engine.setDisabled(name, disabled);
    }
    setReadonly(name, readonly) {
        this._engine.setReadonly(name, readonly);
    }
    claimField(name) {
        this._engine.claimField(name);
    }
    removeField(name) {
        this._engine.removeField(name);
    }
    // ── Private helpers ─────────────────────────────────────────────────────────
    _registerSchema(nodes, prefix, leafPaths, groupPaths) {
        for (const [key, node] of Object.entries(nodes)) {
            const path = prefix ? `${prefix}.${key}` : key;
            if (node.kind === "field") {
                leafPaths.push(path);
                this._engine.setInitialValue(path, node.initial);
                this._engine.getField(path);
                const marksRequired = node.validators.some((fn) => fn[MDY_MARKS_REQUIRED] === true);
                this._engine.upsertValidators(path, SCHEMA_KEY, node.validators, marksRequired);
                if (node.asyncValidators.length > 0) {
                    this._engine.upsertAsyncValidators(path, SCHEMA_KEY, node.asyncValidators, { debounceMs: node.asyncDebounceMs });
                }
            }
            else {
                groupPaths.add(path);
                this._registerSchema(node.children, path, leafPaths, groupPaths);
            }
        }
    }
    _buildHandleTree(nodes, prefix) {
        const out = {};
        for (const [key, node] of Object.entries(nodes)) {
            const path = prefix ? `${prefix}.${key}` : key;
            out[key] =
                node.kind === "field"
                    ? this._buildHandle(path)
                    : this._buildHandleTree(node.children, path);
        }
        return out;
    }
    _buildHandle(path) {
        const ref = this._engine.getField(path);
        if (!ref) {
            throw new Error(`[modyra] Field "${path}" was not registered`);
        }
        const state = ref();
        return {
            path,
            value: state.value,
            errors: state.errors,
            touched: state.touched,
            dirty: state.dirty,
            valid: state.valid,
            pending: state.pending,
            required: state.required,
            disabled: state.disabled,
            set: (v) => state.value.set(v),
            markAsTouched: () => state.touched.set(true),
            markAsDirty: () => state.dirty.set(true),
        };
    }
    /** Rebuilds the nested value shape from the engine's flat dotted paths. */
    _unflatten(flat) {
        const out = {};
        for (const [path, v] of Object.entries(flat)) {
            const parts = path.split(".");
            let target = out;
            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i];
                if (part === undefined)
                    continue;
                const existing = target[part];
                if (existing !== null && typeof existing === "object") {
                    target = existing;
                }
                else {
                    const next = {};
                    target[part] = next;
                    target = next;
                }
            }
            const leaf = parts[parts.length - 1];
            if (leaf !== undefined)
                target[leaf] = v;
        }
        return out;
    }
    /** Flattens a (possibly nested) patch object into dotted engine paths. */
    _flattenPatch(partial) {
        const flat = {};
        const walk = (node, prefix) => {
            for (const [key, v] of Object.entries(node)) {
                const path = prefix ? `${prefix}.${key}` : key;
                if (this._groupPaths.has(path) &&
                    v !== null &&
                    typeof v === "object") {
                    walk(v, path);
                }
                else {
                    flat[path] = v;
                }
            }
        };
        walk(partial, "");
        return flat;
    }
    _pathGet(value, path) {
        let current = value;
        for (const part of path.split(".")) {
            if (current === null || typeof current !== "object")
                return null;
            current = current[part];
        }
        return current === undefined ? null : current;
    }
}
