/**
 * Orders → lines → allocations, and invoices → lines → splits, in Lit: three keyed levels driven
 * through handles. The interface renders portions of the structure; the model owns it whole.
 *
 * Each demo reads as a business page, not a debug view: a scenario paragraph, actions that say what
 * they will do, the hierarchy drawn level by level, and a verdict in sentences with the raw state
 * behind a `<details>` — the same vocabulary the other renderers use for the same demos.
 */
import { html, LitElement, nothing } from "lit";
import { createLitForm, field, group, record, required, MdyFormController } from "@modyra/lit/adapter";
import { serverValidator } from "@modyra/core";
import { defineMdyElements } from "@modyra/lit";

defineMdyElements();

/** The paragraph that says who the reader is and what they are looking at. */
const scenario = (text) => html`<p class="demo-scenario">${text}</p>`;

/** A caption naming which level of the hierarchy the content belongs to. */
const level = (caption, content) => html`<div class="demo-level">
  <div class="demo-level-caption">${caption}</div>${content}
</div>`;

/** A pill for a state a reader should see without reading the JSON. */
const badge = (text) => html`<span class="demo-badge">${text}</span>`;

/** Sentences above, the raw JSON behind a `<details>` — one state, two readings. */
const verdict = (rows, state) => html`
  <ul class="demo-verdict">${rows.map(([cls, text]) => html`<li class=${cls}>${text}</li>`)}</ul>
  <details><summary>dati grezzi (JSON)</summary>
    <pre class="demo-state">${JSON.stringify(state, null, 2)}</pre>
  </details>`;

const lotAvailable = async (value) => {
  await new Promise((resolve) => setTimeout(resolve, 120));
  return value === "L-DEAD" ? "Lot unavailable" : null;
};

const linesCovered = (lines) => {
  const failures = [];
  for (const [key, line] of Object.entries(lines ?? {})) {
    const allocated = Object.values(line.allocs ?? {}).reduce((sum, a) => sum + Number(a.qty ?? 0), 0);
    if (allocated !== Number(line.qty ?? 0)) failures.push(`line ${key}: allocated ${allocated} of ${line.qty}`);
  }
  return failures;
};

class NestedOrders extends LitElement {
  static properties = { filter: { state: true }, collapsed: { state: true } };

  form = createLitForm({
    orders: record(group({
      customer: field("", [required()]),
      lines: record(group({
        sku: field("", [required()]),
        qty: field(1),
        allocs: record(group({
          warehouse: field(""),
          lot: field("", [], serverValidator(lotAvailable, { debounceMs: 50 })),
          qty: field(0),
        })),
      }), { validators: [linesCovered] }),
    })),
  }, { history: true });

  constructor() {
    super();
    this.filter = "";
    this.collapsed = new Set();
    this.form.f.orders.upsert("tmp:1", {
      customer: "Acme",
      lines: { l1: { sku: "SKU-1", qty: 3, allocs: { a1: { warehouse: "W1", lot: "L-7", qty: 2 } } } },
    });
    this._tracker = new MdyFormController(this, [
      this.form.f.orders.keys, this.form.value, this.form.state.valid, this.form.state.pending,
      this.form.canUndo, this.form.canRedo,
    ]);
  }

  createRenderRoot() { return this; }

  #first() { return this.form.f.orders.keys()[0]; }

  /** The state both halves of the panel read, collected once per render. */
  #state() {
    const orders = this.form.f.orders;
    return {
      orders: orders.keys(),
      lines: Object.fromEntries(orders.keys().map((k) => [k, orders.row(k).lines.keys()])),
      valid: this.form.state.valid(),
      pending: this.form.state.pending(),
      lineErrors: Object.fromEntries(orders.keys().map((k) => [k, orders.row(k).lines.errors()]).filter(([, e]) => e.length > 0)),
      canUndo: this.form.canUndo(),
      canRedo: this.form.canRedo(),
      value: this.form.getValue().orders,
    };
  }

  #sentences(s) {
    const rows = [];
    rows.push(s.valid
      ? ["ok", "Tutti i controlli passano: ogni riga e coperta dalle sue allocazioni"]
      : ["ko", "L'ordine non e completo — vedi sotto"]);
    if (s.pending) rows.push(["", "… verifica disponibilita lotto in corso"]);
    for (const key of s.orders) {
      rows.push(["", key.startsWith("tmp:")
        ? `Ordine ${key} — provvisorio, in attesa del codice server`
        : `Ordine ${key} — confermato`]);
    }
    for (const errs of Object.values(s.lineErrors)) {
      for (const e of errs) rows.push(["ko", e.message.replace(/^line (\S+): allocated (\d+) of (\d+)$/, "Riga $1 — allocati $2 su $3")]);
    }
    if (s.canUndo) rows.push(["", "Undo disponibile: l'ultima operazione e reversibile, struttura inclusa"]);
    return rows;
  }

  render() {
    const orders = this.form.f.orders;
    const state = this.#state();
    return html`
      <h1>Ordini, righe, allocazioni</h1>
      ${scenario(
        "Sei un operatore logistico. Gestisci ordini che contengono righe di prodotto, e ogni riga " +
        "va coperta da allocazioni di magazzino. La demo mostra che ordinare, filtrare e chiudere " +
        "pezzi di interfaccia non tocca mai i dati: il modello possiede tutto, lo schermo ne mostra " +
        "una parte.",
      )}
      <div class="bar">
        <button class="demo-action" @click=${() => { orders.upsert(`tmp:${orders.keys().length + 1}`, { customer: "New Co", lines: {} }); }}><span>Add order</span><small>crea un ordine con chiave provvisoria tmp:*</small></button>
        <button class="demo-action" @click=${() => { const p = orders.keys().find((k) => k.startsWith("tmp:")); if (p) orders.rename(p, `ORD-${100 + orders.keys().length}`); }}><span>Server assigns code</span><small>il server risponde: la chiave tmp diventa ORD-*, i dati restano</small></button>
        <button class="demo-action" @click=${() => { const k = this.#first(); if (!k) return; const lines = orders.row(k).lines; const lk = lines.keys()[0]; if (!lk) return; const allocs = lines.row(lk).allocs; allocs.upsert(`a${allocs.keys().length + 1}`, { warehouse: "W2", lot: "L-9", qty: 1 }); }}><span>Add allocation</span><small>aggiunge un'allocazione alla prima riga (copre la quantita)</small></button>
        <button class="demo-action" @click=${() => { const k = this.#first(); if (k) orders.remove(k); }}><span>Remove order</span><small>elimina il primo ordine con tutte le righe e allocazioni</small></button>
        <button class="demo-action" @click=${() => { this.form.undo(); }}><span>Undo</span><small>ripristina intero l'ultimo ordine rimosso</small></button>
        <button class="demo-action" @click=${() => { const k = this.#first(); if (!k) return; const next = new Set(this.collapsed); next.has(k) ? next.delete(k) : next.add(k); this.collapsed = next; }}><span>Collapse first</span><small>nasconde le righe del primo ordine: la validita non cambia</small></button>
        <button class="demo-action" @click=${() => { this.filter = this.filter ? "" : "ORD"; }}><span>Filter ORD</span><small>mostra solo gli ordini confermati: i tmp restano nel modello</small></button>
      </div>
      ${orders.keys().filter((k) => !this.filter || k.includes(this.filter)).map((orderKey) => {
        const order = orders.row(orderKey);
        const hidden = order.lines.keys().length;
        return html`<div class="order-box" data-order=${orderKey}>
          <strong>Ordine ${orderKey} — ${order.customer.value()} ${orderKey.startsWith("tmp:") ? badge("provvisorio") : nothing}</strong>
          ${this.collapsed.has(orderKey)
            ? html`<p class="demo-hidden-note">${hidden} ${hidden === 1 ? "riga nascosta" : "righe nascoste"} — validita ed errori restano attivi</p>`
            : order.lines.keys().map((lineKey) => {
                const line = order.lines.row(lineKey);
                return level(`Riga ${lineKey} — prodotto e quantita`, html`
                  <div class="grid" data-line=${`${orderKey}.${lineKey}`}>
                    <mdy-text-field aria-label=${`SKU ${lineKey}`} .field=${line.sku}></mdy-text-field>
                    <mdy-number-field aria-label=${`Qty ${lineKey}`} .field=${line.qty}></mdy-number-field>
                  </div>
                  ${line.allocs.keys().map((allocKey) => level(`Allocazione ${allocKey} — lotto e quantita coperta`, html`
                    <div class="grid" data-alloc=${`${orderKey}.${lineKey}.${allocKey}`}>
                      <mdy-text-field aria-label=${`Lot ${allocKey}`} .field=${line.allocs.row(allocKey).lot}></mdy-text-field>
                      <mdy-number-field aria-label=${`Allocated ${allocKey}`} .field=${line.allocs.row(allocKey).qty}></mdy-number-field>
                    </div>`))}`);
              })}
        </div>`;
      })}
      ${verdict(this.#sentences(state), state)}`;
  }
}
customElements.define("nested-orders", NestedOrders);

const linesBalanced = (lines) => {
  const failures = [];
  for (const [key, line] of Object.entries(lines ?? {})) {
    const splits = Object.entries(line.splits ?? {});
    const total = splits.reduce((sum, [, s]) => sum + Number(s.percent ?? 0), 0);
    if (total !== 100) failures.push(`line ${key}: splits total ${total}%`);
    const centres = splits.map(([, s]) => s.costCenter).filter(Boolean);
    if (new Set(centres).size !== centres.length) failures.push(`line ${key}: duplicate cost centre`);
  }
  return failures;
};

class NestedInvoices extends LitElement {
  static properties = { collapsed: { state: true }, approved: { state: true } };

  form = createLitForm({
    invoices: record(group({
      supplier: field("", [required()]),
      lines: record(group({
        desc: field(""),
        amount: field(100),
        splits: record(group({ costCenter: field(""), percent: field(0) })),
      }), { validators: [linesBalanced] }),
    })),
  });

  constructor() {
    super();
    this.collapsed = new Set();
    this.approved = [];
    this.form.f.invoices.upsert("INV-1", {
      supplier: "Acme",
      lines: { l1: { desc: "Consulting", amount: 100, splits: { s1: { costCenter: "CC-10", percent: 60 }, s2: { costCenter: "CC-20", percent: 35 } } } },
    });
    this._tracker = new MdyFormController(this, [this.form.f.invoices.keys, this.form.value, this.form.state.valid]);
  }

  createRenderRoot() { return this; }

  #approve() {
    const base = "invoices.INV-1.lines.l1";
    for (const leaf of ["desc", "amount", "splits.s1.costCenter", "splits.s1.percent", "splits.s2.costCenter", "splits.s2.percent"]) {
      this.form.setReadonly(`${base}.${leaf}`, () => true);
    }
    this.approved = [...this.approved, base];
  }

  /** The state both halves of the panel read, collected once per render. */
  #state() {
    const invoices = this.form.f.invoices;
    return {
      invoices: invoices.keys(),
      lines: Object.fromEntries(invoices.keys().map((k) => [k, invoices.row(k).lines.keys()])),
      valid: this.form.state.valid(),
      lineErrors: Object.fromEntries(invoices.keys().map((k) => [k, invoices.row(k).lines.errors()]).filter(([, e]) => e.length > 0)),
      approved: this.approved,
      splitServerError: this.form.errorsFor("invoices.INV-1.lines.l1.splits.s1.percent")().map((e) => e.message),
      value: this.form.getValue().invoices,
    };
  }

  #sentences(s) {
    const readable = (message) => message
      .replace(/^line (\S+): splits total (\d+)%$/, "Riga $1 — ripartito $2%, manca il resto per arrivare a 100")
      .replace(/^line (\S+): duplicate cost centre$/, "Riga $1 — lo stesso centro di costo compare due volte");
    const rows = [];
    rows.push(s.valid
      ? ["ok", "Fattura pronta: ogni riga e ripartita al 100%"]
      : ["ko", "Fattura bloccata — le ripartizioni non tornano"]);
    for (const [key, errs] of Object.entries(s.lineErrors)) {
      for (const e of errs) rows.push(["ko", `${key}: ${readable(e.message)}`]);
    }
    for (const base of s.approved) rows.push(["", `${base.split(".").slice(-1)[0]} approvata — sola lettura, ma sempre validata e inviata`]);
    for (const message of s.splitServerError) rows.push(["ko", `Il server rifiuta la ripartizione s1: ${message}`]);
    if (this.collapsed.size > 0) rows.push(["", "Una riga e chiusa: il verdetto qui sopra la conta comunque"]);
    return rows;
  }

  render() {
    const invoices = this.form.f.invoices;
    const state = this.#state();
    return html`
      <h1>Fatture, righe, ripartizioni</h1>
      ${scenario(
        "Sei in amministrazione. Ogni fattura ha righe di spesa, e ogni riga va ripartita fra centri " +
        "di costo fino a coprire il 100%. La demo mostra che chiudere una riga non la mette a posto: " +
        "una ripartizione incompleta continua a bloccare la fattura anche quando nessuno la guarda.",
      )}
      <div class="bar">
        <button class="demo-action" @click=${() => { const next = new Set(this.collapsed); next.add("INV-1.l1"); this.collapsed = next; }}><span>Close the line</span><small>nasconde la riga: la fattura resta invalida al 95%</small></button>
        <button class="demo-action" @click=${() => { const next = new Set(this.collapsed); next.delete("INV-1.l1"); this.collapsed = next; }}><span>Reopen the line</span><small>riapre la riga: l'errore e ancora sulla ripartizione che lo causa</small></button>
        <button class="demo-action" @click=${() => { invoices.row("INV-1").lines.row("l1").splits.row("s2").percent.set(40); }}><span>Fix the split</span><small>porta CC-20 dal 35% al 40%: la ripartizione arriva a 100</small></button>
        <button class="demo-action" @click=${() => this.#approve()}><span>Approve the line</span><small>blocca la riga in sola lettura: resta validata e inviata</small></button>
        <button class="demo-action" @click=${() => { this.form.submit(async () => [{ path: "invoices.INV-1.lines.l1.splits.s1.percent", kind: "server", message: "CC-10 is frozen this quarter" }]); }}><span>Submit to the server</span><small>il server rifiuta CC-10: l'errore torna sul path della ripartizione</small></button>
      </div>
      ${invoices.keys().map((invKey) => html`<div class="order-box" data-invoice=${invKey}>
        <strong>Fattura ${invKey} — ${invoices.row(invKey).supplier.value()}</strong>
        ${invoices.row(invKey).lines.keys().map((lineKey) => {
          const line = invoices.row(invKey).lines.row(lineKey);
          const approved = this.approved.includes(`invoices.${invKey}.lines.${lineKey}`);
          const hidden = line.splits.keys().length;
          if (this.collapsed.has(`${invKey}.${lineKey}`)) {
            return html`<p class="demo-hidden-note">Riga ${lineKey} chiusa — ${hidden} ${hidden === 1 ? "ripartizione nascosta" : "ripartizioni nascoste"}, la fattura resta bloccata finche non arrivano al 100%</p>`;
          }
          return level(html`Riga ${lineKey} — descrizione e importo ${approved ? badge("approvata: sola lettura") : nothing}`, html`
            <div class="grid" data-line=${`${invKey}.${lineKey}`}>
              <mdy-text-field aria-label=${`Description ${lineKey}`} .field=${line.desc}></mdy-text-field>
              <mdy-number-field aria-label=${`Amount ${lineKey}`} .field=${line.amount}></mdy-number-field>
            </div>
            ${line.splits.keys().map((splitKey) => level(`Ripartizione ${splitKey} — centro di costo e quota`, html`
              <div class="grid" data-split=${`${invKey}.${lineKey}.${splitKey}`}>
                <mdy-text-field aria-label=${`Cost centre ${splitKey}`} .field=${line.splits.row(splitKey).costCenter}></mdy-text-field>
                <mdy-number-field aria-label=${`Percent ${splitKey}`} .field=${line.splits.row(splitKey).percent}></mdy-number-field>
              </div>`))}`);
        })}
      </div>`)}
      ${verdict(this.#sentences(state), state)}`;
  }
}
customElements.define("nested-invoices", NestedInvoices);

/**
 * A line's bands must tile its quantity axis: each band's minimum below its maximum, no two bands
 * covering the same quantity, and no quantity left uncovered between the lowest and the highest.
 */
const bandsTile = (bands) => {
  const failures = [];
  const rows = Object.entries(bands ?? {}).map(([key, b]) => ({
    key, min: Number(b.minQty ?? 0), max: Number(b.maxQty ?? 0),
  }));
  for (const b of rows) {
    if (b.min >= b.max) failures.push(`band ${b.key}: min ${b.min} is not below max ${b.max}`);
  }
  const ordered = [...rows].sort((a, b) => a.min - b.min);
  for (let i = 1; i < ordered.length; i += 1) {
    const previous = ordered[i - 1];
    const current = ordered[i];
    if (current.min < previous.max) failures.push(`bands ${previous.key} and ${current.key} overlap at ${current.min}`);
    else if (current.min > previous.max) failures.push(`bands ${previous.key} and ${current.key} leave ${previous.max}-${current.min} uncovered`);
  }
  return failures;
};

/** Across a contract's lines: a price that never rises with quantity. */
const linesCoherent = (lines) => {
  const failures = [];
  for (const [key, line] of Object.entries(lines ?? {})) {
    const bands = Object.entries(line.bands ?? {})
      .map(([bandKey, b]) => ({ key: bandKey, min: Number(b.minQty ?? 0), price: Number(b.price ?? 0) }))
      .sort((a, b) => a.min - b.min);
    for (let i = 1; i < bands.length; i += 1) {
      if (bands[i].price > bands[i - 1].price) {
        failures.push(`line ${key}: band ${bands[i].key} costs more per unit than ${bands[i - 1].key}`);
      }
    }
  }
  return failures;
};

class NestedContracts extends LitElement {
  static properties = { descending: { state: true }, collapsed: { state: true } };

  form = createLitForm({
    contracts: record(group({
      customer: field("", [required()]),
      currency: field("EUR"),
      lines: record(group({
        sku: field(""),
        bands: record(group({ minQty: field(0), maxQty: field(0), price: field(0) }), { validators: [bandsTile] }),
      }), { validators: [linesCoherent] }),
    })),
  });

  constructor() {
    super();
    this.descending = false;
    this.collapsed = false;
    this.form.f.contracts.upsert("C-1", {
      customer: "Acme",
      currency: "EUR",
      lines: { l1: { sku: "SKU-1", bands: {
        b1: { minQty: 1, maxQty: 100, price: 10 },
        b2: { minQty: 100, maxQty: 500, price: 8 },
      } } },
    });
    this._tracker = new MdyFormController(this, [
      this.form.f.contracts.keys, this.form.value, this.form.state.valid,
    ]);
  }

  createRenderRoot() { return this; }

  #bands() { return this.form.f.contracts.row("C-1").lines.row("l1").bands; }

  /** Reading order only: the model's keys are identity, and sorting must not touch them. */
  #order(bands) {
    const byMin = [...bands.keys()].sort((a, b) =>
      Number(bands.row(a).minQty.value()) - Number(bands.row(b).minQty.value()));
    return this.descending ? byMin.reverse() : byMin;
  }

  #state() {
    const contracts = this.form.f.contracts;
    return {
      contracts: contracts.keys(),
      lines: Object.fromEntries(contracts.keys().map((k) => [k, contracts.row(k).lines.keys()])),
      bands: this.#bands().keys(),
      readingOrder: this.#order(this.#bands()),
      valid: this.form.state.valid(),
      bandErrors: this.form.errorsFor("contracts.C-1.lines.l1.bands")().map((e) => e.message),
      lineErrors: Object.fromEntries(contracts.keys().map((k) => [k, contracts.row(k).lines.errors()]).filter(([, e]) => e.length > 0)),
      serverErrors: this.form.errorsFor("contracts.C-1.lines.l1.bands.b2.price")().map((e) => e.message),
      value: this.form.getValue().contracts,
    };
  }

  #sentences(s) {
    const readable = (message) => message
      .replace(/^bands (\S+) and (\S+) overlap at (\d+)$/, "Le fasce $1 e $2 si sovrappongono a partire da $3 pezzi")
      .replace(/^bands (\S+) and (\S+) leave (\d+)-(\d+) uncovered$/, "Fra $1 e $2 le quantita da $3 a $4 non hanno prezzo")
      .replace(/^band (\S+): min (\d+) is not below max (\d+)$/, "La fascia $1 parte da $2 e finisce a $3: non copre nulla")
      .replace(/^line (\S+): band (\S+) costs more per unit than (\S+)$/, "Riga $1 — la fascia $2 costa piu di $3: il prezzo risale col volume");
    const rows = [];
    rows.push(s.valid
      ? ["ok", "Listino coerente: gli scaglioni coprono tutte le quantita e il prezzo scende col volume"]
      : ["ko", "Listino non applicabile — vedi sotto"]);
    for (const message of s.bandErrors) rows.push(["ko", readable(message)]);
    for (const errs of Object.values(s.lineErrors)) {
      for (const e of errs) rows.push(["ko", readable(e.message)]);
    }
    for (const message of s.serverErrors) rows.push(["ko", `Il server blocca la fascia b2: ${message}`]);
    rows.push(["", `Ordine di lettura: ${s.readingOrder.join(" → ")} — chiavi nel modello: ${s.bands.join(", ")}`]);
    return rows;
  }

  render() {
    const contracts = this.form.f.contracts;
    const state = this.#state();
    return html`
      <h1>Contratti, righe, fasce di prezzo</h1>
      ${scenario(
        "Sei al commerciale. Un contratto quadro fissa, per ogni prodotto, gli scaglioni di prezzo: " +
        "da 1 a 100 pezzi un prezzo, da 100 a 500 un altro. La demo mostra che gli scaglioni devono " +
        "coprire tutte le quantita senza buchi ne sovrapposizioni, e che l'errore nomina le due " +
        "fasce in conflitto anche quando sono chiuse.",
      )}
      <div class="bar">
        <button class="demo-action" @click=${() => { this.#bands().row("b2").minQty.set(80); }}><span>Move the threshold</span><small>porta la fascia b2 a partire da 80: si sovrappone a b1</small></button>
        <button class="demo-action" @click=${() => { this.#bands().row("b2").minQty.set(120); }}><span>Leave a gap</span><small>porta la fascia b2 a partire da 120: 100-120 resta scoperto</small></button>
        <button class="demo-action" @click=${() => { this.#bands().row("b2").minQty.set(100); }}><span>Restore the ladder</span><small>riporta b2 a partire da 100: gli scaglioni tornano contigui</small></button>
        <button class="demo-action" @click=${() => { const b = this.#bands(); b.upsert(`b${b.keys().length + 1}`, { minQty: 500, maxQty: 2000, price: 7 }); }}><span>Add a band</span><small>aggiunge lo scaglione oltre i 500 pezzi</small></button>
        <button class="demo-action" @click=${() => { const b = this.#bands(); const last = b.keys()[b.keys().length - 1]; if (last) b.row(last).price.set(99); }}><span>Raise the top price</span><small>porta l'ultimo scaglione sopra il precedente: il prezzo risale</small></button>
        <button class="demo-action" @click=${() => { this.descending = !this.descending; }}><span>Sort bands descending</span><small>inverte solo l'ordine di lettura: le chiavi non cambiano</small></button>
        <button class="demo-action" @click=${() => { this.collapsed = !this.collapsed; }}><span>Collapse the bands</span><small>chiude le fasce: le regole di copertura restano attive</small></button>
        <button class="demo-action" @click=${() => { this.form.submit(async () => [{ path: "contracts.C-1.lines.l1.bands.b2.price", kind: "server", message: "Discount above 20% needs approval" }]); }}><span>Send for approval</span><small>il server rifiuta lo sconto oltre la soglia sulla fascia b2</small></button>
      </div>
      ${contracts.keys().map((contractKey) => {
        const contract = contracts.row(contractKey);
        return html`<div class="order-box" data-contract=${contractKey}>
          <strong>Contratto ${contractKey} — ${contract.customer.value()} ${badge(contract.currency.value())}</strong>
          ${contract.lines.keys().map((lineKey) => {
            const line = contract.lines.row(lineKey);
            const hidden = line.bands.keys().length;
            return level(`Riga ${lineKey} — prodotto a listino`, html`
              <div class="grid" data-line=${`${contractKey}.${lineKey}`}>
                <mdy-text-field aria-label=${`SKU ${lineKey}`} .field=${line.sku}></mdy-text-field>
              </div>
              ${this.collapsed
                ? html`<p class="demo-hidden-note">${hidden} ${hidden === 1 ? "fascia nascosta" : "fasce nascoste"} — le regole di copertura restano attive</p>`
                : this.#order(line.bands).map((bandKey) => level(`Fascia ${bandKey} — da quanti pezzi, fino a quanti, a che prezzo`, html`
                    <div class="grid grid--three" data-band=${`${contractKey}.${lineKey}.${bandKey}`}>
                      <mdy-number-field aria-label=${`Min ${bandKey}`} .field=${line.bands.row(bandKey).minQty}></mdy-number-field>
                      <mdy-number-field aria-label=${`Max ${bandKey}`} .field=${line.bands.row(bandKey).maxQty}></mdy-number-field>
                      <mdy-number-field aria-label=${`Price ${bandKey}`} .field=${line.bands.row(bandKey).price}></mdy-number-field>
                    </div>`))}`);
          })}
        </div>`;
      })}
      ${verdict(this.#sentences(state), state)}`;
  }
}
customElements.define("nested-contracts", NestedContracts);
