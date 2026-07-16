import {
  DestroyRef,
  Directive,
  effect,
  inject,
  input,
  untracked,
} from "@angular/core";
import { MDY_OPTIONS_CONTROL } from "../tokens";
import { MdySelectOption } from "../types";

/** Async options loader: receives the current search query. */
export type MdyOptionsLoader<TValue = unknown> = (
  query: string,
) => Promise<ReadonlyArray<MdySelectOption<TValue>>>;

/**
 * Server-side option loading for select/multiselect.
 *
 * Runs the loader on every (debounced) search-query change — including the
 * initial empty query — with the control's loading state driven for the
 * whole debounce+fetch window and last-wins semantics on stale responses.
 *
 * ```html
 * <mdy-control-select
 *   name="city"
 *   searchable
 *   [mdyLoadOptions]="searchCities"
 *   [mdyLoadOptionsDebounce]="300"
 * />
 * ```
 * ```ts
 * searchCities: MdyOptionsLoader<string> = async (q) =>
 *   (await api.cities(q)).map(c => ({ value: c.id, label: c.name }));
 * ```
 */
@Directive({
  selector: "[mdyLoadOptions]",
  standalone: true,
})
export class MdyLoadOptionsDirective {
  private readonly control = inject(MDY_OPTIONS_CONTROL);

  readonly mdyLoadOptions = input.required<MdyOptionsLoader>();
  /** Milliseconds of typing inactivity before the loader runs. Default 300. */
  readonly mdyLoadOptionsDebounce = input<number>(300);

  private _runId = 0;
  private _timer: ReturnType<typeof setTimeout> | null = null;
  /**
   * Reload only when the query changes: an inline-lambda loader gets a new
   * identity on every change detection and would otherwise refetch in a
   * loop (R22). A loader identity change alone does not retrigger.
   */
  private _lastQuery: string | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this._runId++; // discard in-flight responses
      if (this._timer !== null) clearTimeout(this._timer);
      this.control.loadingOverride.set(null);
      this.control.overrideOptions.set(null);
    });

    effect(() => {
      const loader = this.mdyLoadOptions();
      const query = this.control.searchQuery();
      const debounceMs = this.mdyLoadOptionsDebounce();
      untracked(() => this._schedule(loader, query, debounceMs));
    });
  }

  private _schedule(
    loader: MdyOptionsLoader,
    query: string,
    debounceMs: number,
  ): void {
    if (query === this._lastQuery) return;
    this._lastQuery = query;
    const runId = ++this._runId;
    if (this._timer !== null) clearTimeout(this._timer);
    this.control.loadingOverride.set(true);
    this._timer = setTimeout(() => {
      this._timer = null;
      void loader(query)
        .then((options) => {
          if (runId !== this._runId) return; // stale response: last-wins
          this.control.overrideOptions.set(options);
          this.control.loadingOverride.set(false);
        })
        .catch(() => {
          if (runId !== this._runId) return;
          this.control.overrideOptions.set([]);
          this.control.loadingOverride.set(false);
        });
    }, debounceMs);
  }
}
