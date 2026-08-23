/**
 * Which of a select's two shapes a test means.
 *
 * A select draws one of two things, and the contract says both are legitimate: a **native chooser**,
 * where the platform owns the list and the keyboard, or a **combobox** the library draws and opens
 * itself. Both carry `mdy-select__trigger`, because both are the thing a person presses to choose.
 *
 * So a selector naming that class alone names both shapes, and `.first()` picks whichever the document
 * happens to put first — **six of them on the demo page, four native and two comboboxes**. A test about
 * a popup the library draws, pointed at a native chooser, presses it, the platform's own list opens
 * outside the document, and the test waits for a dropdown that was never going to appear.
 *
 * `.first()` answers a question about document order, and a test that asks it gets a true answer to
 * the wrong question.
 *
 * **The shape is named by the promise it makes.** A combobox declares `aria-haspopup`; a native chooser
 * does not, because the platform's list is not something the page opens. That is the contract's own
 * distinction rather than a tag or a position, so it survives a renderer changing which element it
 * draws — and a select that stops declaring the popup is caught rather than quietly matched.
 */

/** A select that opens a list this library draws. */
export const COMBOBOX_SELECT = ".mdy-renderer--select:has(.mdy-select__trigger[aria-haspopup])";

/** The thing pressed to open it. */
export const COMBOBOX_TRIGGER = `${COMBOBOX_SELECT} .mdy-select__trigger[aria-haspopup]`;
