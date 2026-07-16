import { ChangeDetectionStrategy, Component, input, computed, inject } from "@angular/core";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import { MDY_ICONS, MdyIconName } from "../core/icons";

/**
 * Lightweight component to render SVGs from the shared icon library.
 */
@Component({
  selector: "mdy-icon",
  standalone: true,
  template: `
    @if (iconData(); as data) {
      <svg
        [attr.viewBox]="data.viewBox"
        fill="none"
        stroke="currentColor"
        [attr.stroke-width]="strokeWidth()"
        xmlns="http://www.w3.org/2000/svg"
        [innerHTML]="safeContent()"
        aria-hidden="true"
      ></svg>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      line-height: 1;
    }
    svg {
      width: 1em;
      height: 1em;
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MdyIconComponent {
  private readonly sanitizer = inject(DomSanitizer);

  /** Name of the icon to render from the MDY_ICONS registry. */
  readonly name = input.required<MdyIconName>();
  readonly strokeWidth = input<number>(2);

  protected readonly iconData = computed(() => MDY_ICONS[this.name()]);

  // Defensive ?. — an unknown icon name renders nothing instead of throwing (B28).
  protected readonly safeContent = computed((): SafeHtml =>
    this.sanitizer.bypassSecurityTrustHtml(this.iconData()?.content ?? "")
  );
}
