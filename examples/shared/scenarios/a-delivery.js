/**
 * A story: somebody is having something delivered.
 *
 * The catalogue beside this one carries the coverage — one field of every kind, on a page nobody
 * would fill in. This one carries a task: an address, a date the parcel may arrive, how it should
 * get there, and a note for the driver. Every field earns its place by the errand rather than by the
 * kind it happens to draw.
 *
 * **Declared here, rendered by each demo in its own idiom.** What a form *is* — the fields, the
 * words, the rules — is the same on every page; how it is mounted is the framework's business. Split
 * the other way, four pages become four products wearing one name, and "the delivery example" stops
 * meaning the same thing twice.
 *
 * **What it deliberately does not carry**: markup, classes, ARIA, or which element a kind draws as.
 * Those are the contract's answers, and a demo writing them by hand is the thing this library exists
 * to stop.
 */

/** Where a parcel can be left, in the order a person would consider them. */
function dropOptions() {
  return [
    { value: "door", label: "At the door" },
    { value: "neighbour", label: "With a neighbour" },
    { value: "locker", label: "In a parcel locker" },
  ];
}

/**
 * The fields, and what each is for.
 *
 * `required` is stated where a delivery genuinely cannot proceed without it — the address and the
 * day — and left off the rest. A form that marks everything required teaches a reader that the mark
 * means nothing.
 */
export function aDeliveryFields() {
  return [
    { name: "address", kind: "textarea", label: "Delivery address", initial: "", required: true },
    { name: "arrives", kind: "datepicker", label: "Arrives on", initial: null, required: true },
    { name: "window", kind: "timepicker", label: "Earliest you are home", initial: null },
    { name: "dropOff", kind: "segmented", label: "If nobody answers", initial: "door", options: dropOptions() },
    { name: "note", kind: "text", label: "Note for the driver", initial: "" },
  ];
}

/** A story, declared as one. */
export const aDelivery = {
  name: "aDelivery",
  title: "A parcel, and where it should go",
  genre: "story",
  fields: aDeliveryFields,
};
