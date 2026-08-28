/**
 * A panel does not open under a press that belongs to the platform.
 *
 * `Cmd+Space` switches the input source, `Cmd+ArrowDown` goes to the end of a document, `Cmd+Z`
 * undoes. Somebody holding the modifier is reaching for one of those. A control that also answers
 * with its own bare-key meaning makes the press do two things, and the panel arrives under the
 * gesture that was meant to leave it.
 *
 * Asked of the renderer rather than of the resolver, because the resolver was already right and was
 * on no road: the question every renderer asks took a *key name*, so what was held with the press
 * never reached the only function that reads it. A defect planted in that function moved no check in
 * either tier.
 *
 * Both directions, so a renderer cannot satisfy this by answering no key at all.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { mountMdyForm } = await import("../dist/index.js");
const { MDY_POPUP_OPENERS, partClasses } = await import("@modyra/widgets");

const OPTIONS = [{ value: "a", label: "A" }];
const OPENING_KEYS = ["Enter", " ", "ArrowDown", "ArrowUp"];

function openerOf(host, kind) {
  const part = MDY_POPUP_OPENERS[kind].opener;
  const classes = partClasses(kind, part)?.classes ?? partClasses(kind, part) ?? [];
  for (const name of classes) {
    const found = host.querySelector(`.${name}`);
    if (found !== null) return found;
  }
  return null;
}

async function pressOn(kind, key, held) {
  const host = document.createElement("div");
  document.body.append(host);
  const { reactivity, dispose } = mountMdyForm(
    host,
    [{ name: "f", kind, label: "F", options: OPTIONS, searchable: true }],
    { submitLabel: null },
  );
  await reactivity.flush();
  const opener = openerOf(host, kind);
  opener?.focus();
  opener?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...held }));
  await reactivity.flush();
  const opened = host.querySelector("[aria-expanded='true']") !== null;
  dispose?.();
  host.remove();
  return { opened, reachable: opener !== null };
}

/**
 * Which kinds demonstrated a bare opening here, collected across the file.
 *
 * Two of these openers are buttons, and a browser synthesises a click from `Enter` on one where this
 * environment does not — so for them the bare press opens nothing, and "it did not open with the
 * modifier either" is true without being evidence. Rather than let that read as a pass per kind, the
 * refusal is still asserted for every kind (a modified press that opened would be the defect however
 * the bare one behaved), and the file as a whole is required to have shown a real opening somewhere.
 */
const demonstrated = [];

for (const kind of Object.keys(MDY_POPUP_OPENERS)) {
  test(`${kind}: a key that opens it does not open it with the modifier held`, async () => {
    for (const key of OPENING_KEYS) {
      const plain = await pressOn(kind, key, {});
      assert.ok(plain.reachable, `${kind} declares an opener the page does not carry`);
      if (plain.opened) demonstrated.push(`${kind} ${key === " " ? "Space" : key}`);

      for (const held of [{ metaKey: true }, { ctrlKey: true }]) {
        const modified = await pressOn(kind, key, held);
        assert.equal(modified.opened, false,
          `${kind} opens on ${Object.keys(held)[0].replace("Key", "")}+${key === " " ? "Space" : key}. `
          + "That press belongs to the platform, and the panel arrives under the gesture that was "
          + "meant to leave it");
      }
    }
  });
}

test("and a bare press really does open something here", () => {
  // The anti-tautology control for the whole file: if nothing opens, every refusal above is a
  // renderer answering no key at all, which would satisfy them and satisfy nobody using it.
  assert.ok(demonstrated.length >= 4,
    `only ${demonstrated.length} bare opening gestures were seen (${demonstrated.join(", ")}) — the `
    + "refusals above are then about presses that do nothing either way");
});

/**
 * The other half, and the half that is not symmetrical.
 *
 * An action that *adds* — opening a panel, committing a value — is refused under the accelerator:
 * answering wrongly puts something there nobody asked for, and the press may have been aimed at the
 * platform. An action that *removes* is honoured whatever is held: answering wrongly costs a reopen,
 * and refusing wrongly leaves somebody inside a panel with the way out not working, which is a
 * keyboard trap and the one class of defect with no exception to argue about.
 *
 * `Escape` in particular is the key a control does not get to reinterpret. Its meaning is *stop*, no
 * modifier changes that on any platform, and where a system claims a modified `Escape` it takes it
 * before the page sees it. The catalogue says so now — the binding declares `modifier: "any"` — so
 * this reads a declaration rather than a habit.
 */
async function openThenPress(kind, key, held) {
  const host = document.createElement("div");
  document.body.append(host);
  const { reactivity, dispose } = mountMdyForm(
    host,
    [{ name: "f", kind, label: "F", options: OPTIONS, searchable: true }],
    { submitLabel: null },
  );
  await reactivity.flush();
  const opener = openerOf(host, kind);
  opener?.focus();
  opener?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  await reactivity.flush();
  const opened = host.querySelector("[aria-expanded='true']") !== null;
  if (!opened) { dispose?.(); host.remove(); return { opened: false }; }

  const from = host.ownerDocument.activeElement ?? opener;
  from.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...held }));
  await reactivity.flush();
  const stillOpen = host.querySelector("[aria-expanded='true']") !== null;
  dispose?.();
  host.remove();
  return { opened: true, stillOpen };
}

const dismissed = [];

for (const kind of Object.keys(MDY_POPUP_OPENERS)) {
  test(`${kind}: Escape closes it whatever is held with it`, async () => {
    for (const held of [{}, { metaKey: true }, { ctrlKey: true }]) {
      const result = await openThenPress(kind, "Escape", held);
      if (!result.opened) continue;
      const how = Object.keys(held)[0]?.replace("Key", "") ?? "bare";
      assert.equal(result.stillOpen, false,
        `${kind} stays open on ${how} Escape. The way out is not conditional on what else a hand `
        + "was resting on, and a panel that refuses it is a keyboard trap that only appears under a "
        + "modifier — which is why nobody finds it");
      dismissed.push(`${kind} ${how}`);
    }
  });
}

test("and Escape really was dismissing something", () => {
  assert.ok(dismissed.length >= 6,
    `only ${dismissed.length} dismissals were seen — the check above is then about panels that never opened`);
});
