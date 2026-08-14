/**
 * What a campaign owes the runtime between two of its runs.
 *
 * A run is self-contained: it builds a form, attacks it, compares it against the reference model and
 * destroys it. Nothing survives it — a destroyed form is collectable, which the false-green suite
 * pins with a control. But a loop that never yields gives the collector no turn to take, so the
 * garbage of thousands of forms piles up until the heap limit ends the process. The campaign then
 * dies without a verdict, and the depth it died at is a cap on what it can find: the sequences worth
 * finding are the rare ones, and rare means deep.
 *
 * Yielding cannot change what a campaign concludes. Runs share nothing and each draws its sequence
 * from its own seed, so the same seed and run count produce the same campaign either way.
 *
 * The interval is a trade: on the conditional campaign at 20,000 runs, yielding every 250 runs holds
 * the peak to 441 MB where an unbroken loop reaches 1,974 MB, and the run time is unchanged within
 * noise.
 */
export async function betweenRuns(run, every = 250) {
  if (run > 0 && run % every === 0) await new Promise((resolve) => setImmediate(resolve));
}
