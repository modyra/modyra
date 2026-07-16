import { booleanAttribute, computed, Directive, input, output, signal } from "@angular/core";
import { MdyOverlayControl } from "./overlay-control.directive";
import { MdyOptionsControl, MdySelectOption } from "./types";

/**
 * Abstract base class for controls that have both an overlay and a list of options.
 *
 * Centralizes:
 * - `options` input
 * - `searchable` input
 * - `overrideOptions` signal (for dynamic/conditional options)
 * - `searchQuery` signal
 * - `effectiveOptions` computed (merges input + override)
 * - `resetSelection` logic
 */
@Directive()
export abstract class MdyOptionsOverlayControl<TValue, TOptionValue = unknown>
  extends MdyOverlayControl<TValue>
  implements MdyOptionsControl<TOptionValue>
{
  /** The list of options available for selection. */
  readonly options = input<readonly MdySelectOption<TOptionValue>[]>([]);

  /** Whether the options are currently being loaded asynchronously. */
  readonly loading = input(false, { transform: booleanAttribute });

  /** Customizable loading text. Defaults to i18n messages. */
  readonly loadingText = input<string | null>(null);

  /** Whether a search input should be displayed in the dropdown/overlay. */
  readonly searchable = input(false, { transform: booleanAttribute });

  /** Internal options override (used by conditional/filter directives). */
  public readonly overrideOptions =
    signal<readonly MdySelectOption<TOptionValue>[] | null>(null);

  /** Internal loading override (used by async directives). */
  public readonly loadingOverride = signal<boolean | null>(null);

  /** Current search query string. */
  public readonly searchQuery = signal("");

  /** Emits every time the search input changes — consumable by host directives. */
  readonly searchChanged = output<string>();

  /**
   * Effective options used for rendering: uses `overrideOptions` if provided,
   * otherwise falls back to the `options` input.
   */
  protected readonly effectiveOptions = computed(
    () => this.overrideOptions() ?? this.options(),
  );

  /**
   * Effective loading state: uses `loadingOverride` if provided,
   * otherwise falls back to the `loading` input.
   */
  public readonly effectiveLoading = computed(
    () => this.loadingOverride() ?? this.loading(),
  );

  /** Reset the control value to its empty state. */
  public abstract resetSelection(): void;

  public override closeOverlay(): void {
    super.closeOverlay();
    // Reset della ricerca alla chiusura dell'overlay
    this.searchQuery.set("");
    this.searchChanged.emit("");
  }

  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
    this.searchChanged.emit(value);
  }
}
