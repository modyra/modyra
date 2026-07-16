import {
    booleanAttribute,
    computed,
    Directive,
    effect,
    HostAttributeToken,
    inject,
    input,
    signal,
    untracked,
} from "@angular/core";
import { MDY_DECLARATIVE_REGISTRY } from "../../core/tokens";

/** Declaratively disables a field by name within an MdyDeclarativeAdapter. */
@Directive({ selector: "[mdyDisabled]", standalone: true })
export class MdyDisabledDirective {
    private readonly registry = inject(MDY_DECLARATIVE_REGISTRY, {
        optional: true,
    });
    private readonly attrName = inject(new HostAttributeToken("name"), {
        optional: true,
    });

    /** Target field name — resolved from the host's attribute or [name] binding. */
    readonly name = input<string>("");

    readonly mdyDisabled = input(true, { transform: booleanAttribute });

    private readonly fieldName = computed(() => this.name() || this.attrName || "");
    private _lastField: string | null = null;

    constructor() {
        // Reacts to [name] bindings too, not only the static attribute (B11).
        effect(() => {
            const field = this.fieldName();
            const registry = this.registry;
            if (!registry || this._lastField === field) return;
            untracked(() => {
                if (this._lastField) {
                    registry.setDisabled(this._lastField, signal(false));
                }
                this._lastField = field || null;
                if (field) {
                    registry.setDisabled(field, computed(() => this.mdyDisabled()));
                }
            });
        });
    }
}
