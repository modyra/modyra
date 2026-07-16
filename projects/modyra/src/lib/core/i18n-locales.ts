import { Provider } from "@angular/core";
import { buildDateLocale, MDY_DATE_LOCALE } from "./date-locale";
import {
  MDY_I18N_MESSAGES,
  MDY_I18N_MESSAGES_DEFAULT,
  MdyI18nMessages,
} from "./i18n";

/** Languages with a built-in message preset. */
export type MdyBuiltInLocale = "en" | "it" | "de" | "fr" | "es";

export const MDY_I18N_MESSAGES_IT: MdyI18nMessages = {
  searchPlaceholder: "Cerca…",
  noResults: "Nessun risultato",
  colorPresetsHeader: "Preset",
  selectColorPrefix: "Seleziona colore",
  colorHexLabel: "Valore esadecimale del colore",
  timepickerOpenLabel: "Apri selettore orario",
  timepickerCancel: "Annulla",
  timepickerConfirm: "OK",
  timepickerHourLabel: "Ora",
  timepickerMinuteLabel: "Minuti",
  timepickerSwitchToDial: "Passa alla vista quadrante",
  timepickerSwitchToInput: "Passa all'inserimento testuale",
  datepickerToggleLabel: "Apri/chiudi calendario",
  datepickerCancel: "Annulla",
  datepickerConfirm: "OK",
  datepickerSelectFallback: "Seleziona data",
  datepickerChooseDate: "Scegli la data",
  datepickerPreviousMonth: "Mese precedente",
  datepickerNextMonth: "Mese successivo",
  datepickerChangeView: (current: string): string =>
    `Cambia vista, attuale ${current}`,
  daterangeChooseRange: "Scegli l'intervallo di date",
  daterangeSelectFallback: "Seleziona intervallo",
  daterangeStartLabel: "Data di inizio",
  daterangeEndLabel: "Data di fine",
  daterangePickStartHint: "Clicca per impostare la data di inizio",
  daterangePickEndHint: "Clicca per impostare la data di fine",
  loading: "Caricamento…",
  increase: "Aumenta",
  decrease: "Diminuisci",
  searchOptionsLabel: "Cerca tra le opzioni",
  fileSelect: "Seleziona file",
  fileSelectMultiple: "Seleziona file",
  fileNoneSelected: "Nessun file selezionato",
  fileClearSelection: "Rimuovi selezione",
  overlayOpened: "Popup aperto",
  overlayClosed: "Popup chiuso",
  selectCreateOption: (query: string): string => `Crea "${query}"`,
  wizardNext: "Avanti",
  wizardPrevious: "Indietro",
  wizardFinish: "Fine",
  wizardStepStatus: (current: number, total: number): string =>
    `Passo ${current} di ${total}`,
};

export const MDY_I18N_MESSAGES_DE: MdyI18nMessages = {
  searchPlaceholder: "Suchen…",
  noResults: "Keine Ergebnisse",
  colorPresetsHeader: "Voreinstellungen",
  selectColorPrefix: "Farbe auswählen",
  colorHexLabel: "Hex-Farbwert",
  timepickerOpenLabel: "Zeitauswahl öffnen",
  timepickerCancel: "Abbrechen",
  timepickerConfirm: "OK",
  timepickerHourLabel: "Stunde",
  timepickerMinuteLabel: "Minute",
  timepickerSwitchToDial: "Zur Ziffernblattansicht wechseln",
  timepickerSwitchToInput: "Zur Texteingabe wechseln",
  datepickerToggleLabel: "Kalender ein-/ausblenden",
  datepickerCancel: "Abbrechen",
  datepickerConfirm: "OK",
  datepickerSelectFallback: "Datum auswählen",
  datepickerChooseDate: "Datum wählen",
  datepickerPreviousMonth: "Vorheriger Monat",
  datepickerNextMonth: "Nächster Monat",
  datepickerChangeView: (current: string): string =>
    `Ansicht wechseln, aktuell ${current}`,
  daterangeChooseRange: "Zeitraum wählen",
  daterangeSelectFallback: "Zeitraum auswählen",
  daterangeStartLabel: "Startdatum",
  daterangeEndLabel: "Enddatum",
  daterangePickStartHint: "Klicken, um das Startdatum zu setzen",
  daterangePickEndHint: "Klicken, um das Enddatum zu setzen",
  loading: "Wird geladen…",
  increase: "Erhöhen",
  decrease: "Verringern",
  searchOptionsLabel: "Optionen durchsuchen",
  fileSelect: "Datei auswählen",
  fileSelectMultiple: "Dateien auswählen",
  fileNoneSelected: "Keine Datei ausgewählt",
  fileClearSelection: "Auswahl entfernen",
  overlayOpened: "Popup geöffnet",
  overlayClosed: "Popup geschlossen",
  selectCreateOption: (query: string): string => `"${query}" erstellen`,
  wizardNext: "Weiter",
  wizardPrevious: "Zurück",
  wizardFinish: "Fertig",
  wizardStepStatus: (current: number, total: number): string =>
    `Schritt ${current} von ${total}`,
};

export const MDY_I18N_MESSAGES_FR: MdyI18nMessages = {
  searchPlaceholder: "Rechercher…",
  noResults: "Aucun résultat",
  colorPresetsHeader: "Préréglages",
  selectColorPrefix: "Sélectionner la couleur",
  colorHexLabel: "Valeur hexadécimale de la couleur",
  timepickerOpenLabel: "Ouvrir le sélecteur d'heure",
  timepickerCancel: "Annuler",
  timepickerConfirm: "OK",
  timepickerHourLabel: "Heure",
  timepickerMinuteLabel: "Minute",
  timepickerSwitchToDial: "Passer à la vue cadran",
  timepickerSwitchToInput: "Passer à la saisie texte",
  datepickerToggleLabel: "Afficher/masquer le calendrier",
  datepickerCancel: "Annuler",
  datepickerConfirm: "OK",
  datepickerSelectFallback: "Sélectionner une date",
  datepickerChooseDate: "Choisir la date",
  datepickerPreviousMonth: "Mois précédent",
  datepickerNextMonth: "Mois suivant",
  datepickerChangeView: (current: string): string =>
    `Changer de vue, actuellement ${current}`,
  daterangeChooseRange: "Choisir la plage de dates",
  daterangeSelectFallback: "Sélectionner la plage",
  daterangeStartLabel: "Date de début",
  daterangeEndLabel: "Date de fin",
  daterangePickStartHint: "Cliquez pour définir la date de début",
  daterangePickEndHint: "Cliquez pour définir la date de fin",
  loading: "Chargement…",
  increase: "Augmenter",
  decrease: "Diminuer",
  searchOptionsLabel: "Rechercher dans les options",
  fileSelect: "Sélectionner un fichier",
  fileSelectMultiple: "Sélectionner des fichiers",
  fileNoneSelected: "Aucun fichier sélectionné",
  fileClearSelection: "Effacer la sélection",
  overlayOpened: "Popup ouvert",
  overlayClosed: "Popup fermé",
  selectCreateOption: (query: string): string => `Créer « ${query} »`,
  wizardNext: "Suivant",
  wizardPrevious: "Retour",
  wizardFinish: "Terminer",
  wizardStepStatus: (current: number, total: number): string =>
    `Étape ${current} sur ${total}`,
};

export const MDY_I18N_MESSAGES_ES: MdyI18nMessages = {
  searchPlaceholder: "Buscar…",
  noResults: "Sin resultados",
  colorPresetsHeader: "Preajustes",
  selectColorPrefix: "Seleccionar color",
  colorHexLabel: "Valor hexadecimal del color",
  timepickerOpenLabel: "Abrir selector de hora",
  timepickerCancel: "Cancelar",
  timepickerConfirm: "OK",
  timepickerHourLabel: "Hora",
  timepickerMinuteLabel: "Minuto",
  timepickerSwitchToDial: "Cambiar a la vista de esfera",
  timepickerSwitchToInput: "Cambiar a la entrada de texto",
  datepickerToggleLabel: "Mostrar/ocultar calendario",
  datepickerCancel: "Cancelar",
  datepickerConfirm: "OK",
  datepickerSelectFallback: "Seleccionar fecha",
  datepickerChooseDate: "Elegir fecha",
  datepickerPreviousMonth: "Mes anterior",
  datepickerNextMonth: "Mes siguiente",
  datepickerChangeView: (current: string): string =>
    `Cambiar vista, actualmente ${current}`,
  daterangeChooseRange: "Elegir intervalo de fechas",
  daterangeSelectFallback: "Seleccionar intervalo",
  daterangeStartLabel: "Fecha de inicio",
  daterangeEndLabel: "Fecha de fin",
  daterangePickStartHint: "Haz clic para establecer la fecha de inicio",
  daterangePickEndHint: "Haz clic para establecer la fecha de fin",
  loading: "Cargando…",
  increase: "Aumentar",
  decrease: "Disminuir",
  searchOptionsLabel: "Buscar en las opciones",
  fileSelect: "Seleccionar archivo",
  fileSelectMultiple: "Seleccionar archivos",
  fileNoneSelected: "Ningún archivo seleccionado",
  fileClearSelection: "Borrar selección",
  overlayOpened: "Ventana emergente abierta",
  overlayClosed: "Ventana emergente cerrada",
  selectCreateOption: (query: string): string => `Crear "${query}"`,
  wizardNext: "Siguiente",
  wizardPrevious: "Atrás",
  wizardFinish: "Finalizar",
  wizardStepStatus: (current: number, total: number): string =>
    `Paso ${current} de ${total}`,
};

const PRESETS: Readonly<Record<MdyBuiltInLocale, MdyI18nMessages>> = {
  en: MDY_I18N_MESSAGES_DEFAULT,
  it: MDY_I18N_MESSAGES_IT,
  de: MDY_I18N_MESSAGES_DE,
  fr: MDY_I18N_MESSAGES_FR,
  es: MDY_I18N_MESSAGES_ES,
};

/** Default BCP 47 tag per built-in language preset. */
const DEFAULT_TAGS: Readonly<Record<MdyBuiltInLocale, string>> = {
  en: "en-US",
  it: "it-IT",
  de: "de-DE",
  fr: "fr-FR",
  es: "es-ES",
};

export interface MdyLocaleOptions {
  /**
   * BCP 47 tag for `Intl`-based date formatting (month/day names, first day
   * of week). Defaults to the canonical tag of the language preset.
   */
  readonly dateLocale?: string;
  /** Per-key overrides applied on top of the language preset. */
  readonly overrides?: Partial<MdyI18nMessages>;
}

/**
 * Provides both UI strings and date localisation with one call:
 *
 * ```ts
 * bootstrapApplication(App, {
 *   providers: [provideModyraLocale("it")],
 * });
 * ```
 *
 * Built-in presets: `en`, `it`, `de`, `fr`, `es`. Use `overrides` to adjust
 * individual keys, or provide `MDY_I18N_MESSAGES` yourself for other
 * languages (the token is a plain object of strings).
 */
export function provideModyraLocale(
  locale: MdyBuiltInLocale,
  options?: MdyLocaleOptions,
): Provider[] {
  const messages: MdyI18nMessages = {
    ...PRESETS[locale],
    ...options?.overrides,
  };
  const tag = options?.dateLocale ?? DEFAULT_TAGS[locale];
  return [
    { provide: MDY_I18N_MESSAGES, useValue: messages },
    { provide: MDY_DATE_LOCALE, useValue: buildDateLocale(tag) },
  ];
}
