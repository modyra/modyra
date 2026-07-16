import {
  ApplicationRef,
  ComponentRef,
  createComponent,
  EnvironmentInjector,
  inject,
  Injectable,
  InjectionToken,
} from "@angular/core";
import { MdyTypedFormLike } from "../core/typed-form";
import { MdyFormsDevtoolsOverlayComponent } from "./mdy-forms-devtools-overlay.component";

/**
 * Hotkey that toggles the devtools overlay, as `modifier+…+key`
 * (`ctrl`, `shift`, `alt`, `meta` plus a single key). Default
 * `ctrl+shift+d` — note this collides with a built-in browser shortcut
 * in some browsers (e.g. bookmark-all-tabs); override it when that
 * matters: `{ provide: MDY_DEVTOOLS_HOTKEY, useValue: "ctrl+alt+i" }`.
 * Provide `null` (or `""`) to disable the hotkey entirely — the overlay
 * stays reachable via {@link MdyFormsDevtoolsService.toggle}.
 */
export const MDY_DEVTOOLS_HOTKEY = new InjectionToken<string | null>(
  "MDY_DEVTOOLS_HOTKEY",
  { providedIn: "root", factory: () => "ctrl+shift+d" },
);

interface DevtoolsRegistration {
  readonly element: HTMLElement;
  readonly form: MdyTypedFormLike;
}

/**
 * Registry + launcher for the devtools overlay. `mdyDevtools` on an
 * `<mdy-form>` registers the form; the hotkey (default Ctrl+Shift+D)
 * toggles a draggable overlay inspecting the **selected** form — the
 * registered form containing the focused element, or the last registered
 * one as a fallback. Also usable programmatically via {@link toggle}.
 */
@Injectable({ providedIn: "root" })
export class MdyFormsDevtoolsService {
  private readonly _appRef = inject(ApplicationRef);
  private readonly _injector = inject(EnvironmentInjector);
  private readonly _hotkey = inject(MDY_DEVTOOLS_HOTKEY);

  private readonly _registrations: DevtoolsRegistration[] = [];
  private _overlay: ComponentRef<MdyFormsDevtoolsOverlayComponent> | null =
    null;
  private _listening = false;
  private _previousFocus: HTMLElement | null = null;

  /** Registers an inspectable form (called by the `mdyDevtools` directive). */
  register(element: HTMLElement, form: MdyTypedFormLike): void {
    this._registrations.push({ element, form });
    this._setupHotkey();
  }

  unregister(element: HTMLElement): void {
    const index = this._registrations.findIndex(r => r.element === element);
    if (index >= 0) this._registrations.splice(index, 1);
    if (this._registrations.length === 0) {
      this.close();
      this._teardownHotkey();
    }
  }

  /** Opens the overlay on the selected (or given) form; closes it if open. */
  toggle(form?: MdyTypedFormLike): void {
    if (this._overlay) {
      this.close();
      return;
    }
    const target = form ?? this._selectForm();
    if (target) this.open(target);
  }

  open(form: MdyTypedFormLike): void {
    if (typeof document === "undefined") return;
    this.close();
    // Remember where focus was so closing can hand it back (a11y).
    this._previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const ref = createComponent(MdyFormsDevtoolsOverlayComponent, {
      environmentInjector: this._injector,
    });
    ref.setInput("form", form);
    ref.instance.closed.subscribe(() => this.close());
    const host = ref.location.nativeElement as HTMLElement;
    document.body.appendChild(host);
    this._appRef.attachView(ref.hostView);
    this._overlay = ref;
    host.focus();
  }

  close(): void {
    if (!this._overlay) return;
    this._appRef.detachView(this._overlay.hostView);
    this._overlay.destroy();
    this._overlay = null;
    this._previousFocus?.focus();
    this._previousFocus = null;
  }

  /** The registered form containing the focused element, else the last one. */
  private _selectForm(): MdyTypedFormLike | null {
    if (this._registrations.length === 0) return null;
    const active = typeof document !== "undefined" ? document.activeElement : null;
    if (active) {
      const focused = this._registrations.find(r => r.element.contains(active));
      if (focused) return focused.form;
    }
    const last = this._registrations[this._registrations.length - 1];
    return last ? last.form : null;
  }

  private _setupHotkey(): void {
    if (this._listening || !this._hotkey || typeof document === "undefined") {
      return;
    }
    this._listening = true;
    document.addEventListener("keydown", this._onKeydown);
  }

  private _teardownHotkey(): void {
    if (!this._listening || typeof document === "undefined") return;
    this._listening = false;
    document.removeEventListener("keydown", this._onKeydown);
  }

  private readonly _onKeydown = (event: KeyboardEvent): void => {
    if (!this._matchesHotkey(event)) return;
    event.preventDefault();
    this.toggle();
  };

  private _matchesHotkey(event: KeyboardEvent): boolean {
    if (!this._hotkey) return false;
    const parts = this._hotkey.toLowerCase().split("+");
    const key = parts[parts.length - 1];
    if (!key || event.key.toLowerCase() !== key) return false;
    return (
      parts.includes("ctrl") === event.ctrlKey &&
      parts.includes("shift") === event.shiftKey &&
      parts.includes("alt") === event.altKey &&
      parts.includes("meta") === event.metaKey
    );
  }
}
