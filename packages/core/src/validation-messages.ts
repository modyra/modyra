/**
 * What a form says when it refuses a value, in the language the form is in.
 *
 * A form given a locale has an Italian label, an Italian calendar, and underneath it one English
 * sentence — the one line a person *has* to read to get any further. The locale was already alive
 * everywhere else: the parser refuses a malformed tag rather than degrading it, it reaches the month
 * names and the first day of the week, and the widget catalogue answers in it. It stopped at the
 * refusals, because a validator's message is written where the validator is called and nothing there
 * knows what language the form speaks.
 *
 * Held here rather than in `@modyra/widgets` for the reason the validators are here: a refusal is a
 * verdict about a value, and a form that never renders still produces one.
 */

/** The sentences a field's own rules can produce. */
export interface MdyValidationMessages {
  readonly required: string;
  readonly email: string;
  readonly pattern: string;
  readonly integer: string;
  readonly dateRangeIncomplete: string;
  minLength(bound: number): string;
  maxLength(bound: number): string;
  min(bound: number): string;
  max(bound: number): string;
}

const EN: MdyValidationMessages = Object.freeze({
  required: "This field is required",
  email: "Invalid email address",
  pattern: "Invalid format",
  integer: "Enter a whole number",
  dateRangeIncomplete: "Enter both a start and an end date",
  minLength: (bound: number): string => `Minimum length is ${bound}`,
  maxLength: (bound: number): string => `Maximum length is ${bound}`,
  min: (bound: number): string => `Minimum value is ${bound}`,
  max: (bound: number): string => `Maximum value is ${bound}`,
});

const IT: MdyValidationMessages = Object.freeze({
  required: "Campo obbligatorio",
  email: "Indirizzo email non valido",
  pattern: "Formato non valido",
  integer: "Inserisci un numero intero",
  dateRangeIncomplete: "Inserisci sia la data di inizio sia quella di fine",
  minLength: (bound: number): string => `La lunghezza minima è ${bound}`,
  maxLength: (bound: number): string => `La lunghezza massima è ${bound}`,
  min: (bound: number): string => `Il valore minimo è ${bound}`,
  max: (bound: number): string => `Il valore massimo è ${bound}`,
});

const DE: MdyValidationMessages = Object.freeze({
  required: "Pflichtfeld",
  email: "Ungültige E-Mail-Adresse",
  pattern: "Ungültiges Format",
  integer: "Bitte eine ganze Zahl eingeben",
  dateRangeIncomplete: "Bitte Start- und Enddatum angeben",
  minLength: (bound: number): string => `Mindestlänge ist ${bound}`,
  maxLength: (bound: number): string => `Maximallänge ist ${bound}`,
  min: (bound: number): string => `Mindestwert ist ${bound}`,
  max: (bound: number): string => `Höchstwert ist ${bound}`,
});

const FR: MdyValidationMessages = Object.freeze({
  required: "Champ obligatoire",
  email: "Adresse e-mail invalide",
  pattern: "Format invalide",
  integer: "Saisissez un nombre entier",
  dateRangeIncomplete: "Saisissez une date de début et une date de fin",
  minLength: (bound: number): string => `La longueur minimale est ${bound}`,
  maxLength: (bound: number): string => `La longueur maximale est ${bound}`,
  min: (bound: number): string => `La valeur minimale est ${bound}`,
  max: (bound: number): string => `La valeur maximale est ${bound}`,
});

const ES: MdyValidationMessages = Object.freeze({
  required: "Campo obligatorio",
  email: "Dirección de correo no válida",
  pattern: "Formato no válido",
  integer: "Introduce un número entero",
  dateRangeIncomplete: "Introduce la fecha de inicio y la de fin",
  minLength: (bound: number): string => `La longitud mínima es ${bound}`,
  maxLength: (bound: number): string => `La longitud máxima es ${bound}`,
  min: (bound: number): string => `El valor mínimo es ${bound}`,
  max: (bound: number): string => `El valor máximo es ${bound}`,
});

/** Every language this package refuses in, by the tag a document writes. */
export const MDY_VALIDATION_MESSAGES: Readonly<Record<string, MdyValidationMessages>> = Object.freeze({
  en: EN,
  it: IT,
  de: DE,
  fr: FR,
  es: ES,
});

export const MDY_VALIDATION_MESSAGES_DEFAULT = EN;

/**
 * The refusals for a locale tag, falling back to the language before the region and then to English.
 *
 * `it-CH` speaks Italian; a tag nobody translated is answered in the language every one of these
 * started as, which is a form that refuses in a language rather than a form that refuses in nothing.
 */
export function validationMessagesForLocale(locale?: string): MdyValidationMessages {
  if (typeof locale !== "string" || locale === "") return MDY_VALIDATION_MESSAGES_DEFAULT;
  const exact = MDY_VALIDATION_MESSAGES[locale.toLowerCase()];
  if (exact) return exact;
  const language = locale.toLowerCase().split("-")[0] ?? "";
  return MDY_VALIDATION_MESSAGES[language] ?? MDY_VALIDATION_MESSAGES_DEFAULT;
}
