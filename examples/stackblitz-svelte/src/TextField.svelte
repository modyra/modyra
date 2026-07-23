<script>
  import { toStore } from "@modyra/svelte";

  export let label;
  export let handle;
  export let type = "text";

  const valueStore = toStore(handle.value);
  const errorsStore = toStore(handle.errors);
  const touchedStore = toStore(handle.touched);
  const validStore = toStore(handle.valid);
  const pendingStore = toStore(handle.pending);
  const requiredStore = toStore(handle.required);
</script>

<div class="mdy-renderer mdy-renderer--text" class:mdy-renderer--touched={$touchedStore}>
  <label class="mdy-label">
    {label}
    {#if $requiredStore}<span class="mdy-label__required" aria-hidden="true">*</span>{/if}
  </label>
  <div class="mdy-input-wrapper">
    <input
      {type}
      value={$valueStore ?? ""}
      aria-invalid={!$validStore}
      aria-required={$requiredStore}
      on:input={(e) => handle.set(e.target.value)}
      on:blur={() => handle.markAsTouched()}
    />
  </div>
  {#if $pendingStore}
    <div class="mdy-supporting-text" role="status">checking…</div>
  {/if}
  {#if $touchedStore && $errorsStore.length > 0}
    <ul class="mdy-control__errors" role="alert">
      {#each $errorsStore as er}<li class="mdy-control__error">{er.message}</li>{/each}
    </ul>
  {/if}
</div>
