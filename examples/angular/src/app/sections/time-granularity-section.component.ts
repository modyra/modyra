import { ChangeDetectionStrategy, Component, computed } from "@angular/core";
import { field, mdyForm } from "@modyra/angular/adapter";
import { MdyFormComponent, MdySupportingTextDirective, MdyTimepickerComponent } from "@modyra/angular/ui";

/**
 * Every shape a declared granularity can take, side by side, so it can be tried by hand.
 *
 * Two of these exist because they broke the obvious implementations. `hourStep: 3` puts an hour on
 * each ring at the same position — 3 outside and 15 inside — so the shortened hand is the only thing
 * that says which was chosen. `hourStep: 7` leaves a single hour on the whole outer ring, which is
 * where a rule that only ever looks at the pointer's own ring runs out of numbers to offer.
 *
 * No automated tier can ask what these feel like: dragging a hand under real pointer capture is not
 * something jsdom can produce, and the browser tier has no Angular host. This section is the
 * instrument for that question.
 */
@Component({
  selector: "app-time-granularity-section",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MdyFormComponent, MdySupportingTextDirective, MdyTimepickerComponent],
  template: `
    <section class="demo-section">
      <h2>Orari a passo</h2>
      <p class="demo-scenario">
        Un campo orario può offrire solo alcuni degli orari possibili: ogni cinque minuti per le
        prenotazioni, ogni mezz'ora per i turni, passi diversi per fascia. La regola vale per ogni
        strada verso il valore — le frecce, la digitazione, i numeri disegnati e la lancetta
        trascinata — e un valore già fuori passo viene <strong>tenuto e mostrato</strong>, mai
        arrotondato: si segnala invalido e basta.
      </p>

      <mdy-form [form]="form">
        <div class="form-row">
          <mdy-control-timepicker [field]="form.f.free" label="Nessun passo (24h)" format="24h">
            <div *mdySupportingText>Come è sempre stato: ogni minuto è raggiungibile.</div>
          </mdy-control-timepicker>

          <mdy-control-timepicker
            [field]="form.f.everyFive"
            label="Ogni 5 minuti"
            format="24h"
            [granularity]="{ minuteStep: 5 }"
          >
            <div *mdySupportingText>Il caso minimo richiesto.</div>
          </mdy-control-timepicker>

          <mdy-control-timepicker
            [field]="form.f.everyQuarter"
            label="Ogni 15 minuti"
            format="24h"
            [granularity]="{ minuteStep: 15 }"
          >
            <div *mdySupportingText>Il quadrante dei minuti mostra quattro numeri, non dodici.</div>
          </mdy-control-timepicker>
        </div>

        <div class="form-row">
          <mdy-control-timepicker
            [field]="form.f.everyThirdHour"
            label="Ogni 3 ore (24h)"
            format="24h"
            [granularity]="{ hourStep: 3 }"
          >
            <div *mdySupportingText>
              3 e 15 stanno alla stessa posizione, uno per anello: la lancetta più corta è l'unica
              differenza visibile fra le due scelte.
            </div>
          </mdy-control-timepicker>

          <mdy-control-timepicker
            [field]="form.f.everySeventhHour"
            label="Ogni 7 ore (24h)"
            format="24h"
            [granularity]="{ hourStep: 7 }"
          >
            <div *mdySupportingText>
              Un solo numero sull'anello esterno: trascinando altrove la lancetta deve uscire
              dall'anello per trovare qualcosa da prendere.
            </div>
          </mdy-control-timepicker>

          <mdy-control-timepicker
            [field]="form.f.twelveHour"
            label="Ogni 15 minuti (12h)"
            format="12h"
            [granularity]="{ minuteStep: 15 }"
          >
            <div *mdySupportingText>La stessa dichiarazione sull'altro quadrante.</div>
          </mdy-control-timepicker>
        </div>

        <div class="form-row">
          <mdy-control-timepicker
            [field]="form.f.byBand"
            label="Passi per fascia"
            format="24h"
            [granularity]="bandedDay"
          >
            <div *mdySupportingText>
              Cinque minuti dalle 09 alle 12, mezz'ora dalle 12 alle 18, un'ora fuori: le fasce si
              affiancano senza buchi perché la fine è esclusa.
            </div>
          </mdy-control-timepicker>

          <mdy-control-timepicker
            [field]="form.f.alreadyOff"
            label="Valore già fuori passo"
            format="24h"
            [granularity]="{ minuteStep: 15 }"
          >
            <div *mdySupportingText>
              Parte da 09:07 con un passo di 15. Resta 09:07 — nessuno lo arrotonda — e il campo si
              dichiara invalido finché non lo si sposta.
            </div>
          </mdy-control-timepicker>

          <!-- L'altra rotta: un nome che il form risolve, invece della maniglia legata. Le due sono
               due consumatori, e mostrarne uno solo è come il difetto zoneless è rimasto nascosto. -->
          <mdy-control-timepicker
            name="byName"
            label="Ogni 30 minuti (per nome)"
            format="24h"
            [granularity]="{ minuteStep: 30 }"
          >
            <div *mdySupportingText>La stessa regola, dichiarata su un campo raggiunto per nome.</div>
          </mdy-control-timepicker>
        </div>
      </mdy-form>

      <pre class="demo-values">{{ shown() }}</pre>
    </section>
  `,
})
export class TimeGranularitySectionComponent {
  /** What each field holds, so a refusal is visible as a value that did not move. */
  readonly shown = computed(() => JSON.stringify(this.form.value(), null, 2));

  /** Half-open, so mezzogiorno appartiene alla fascia che comincia lì e non a quella che finisce. */
  readonly bandedDay = {
    minuteStep: 60,
    windows: [
      { from: "09:00", to: "12:00", minuteStep: 5 },
      { from: "12:00", to: "18:00", minuteStep: 30 },
    ],
  };

  readonly form = mdyForm({
    free: field<string | null>("09:07"),
    everyFive: field<string | null>("09:05"),
    everyQuarter: field<string | null>("09:15"),
    everyThirdHour: field<string | null>("15:00"),
    everySeventhHour: field<string | null>("07:00"),
    twelveHour: field<string | null>("09:15"),
    byBand: field<string | null>("09:05"),
    alreadyOff: field<string | null>("09:07"),
    byName: field<string | null>("09:30"),
  });
}
