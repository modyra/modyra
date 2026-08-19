/**
 * What a collection manager is to the collection above it.
 *
 * A record's row may hold an array and an array's row may hold a record, so each kind has to build
 * the other. Naming the other class directly would make neither module movable without its
 * counterpart; the enclosing collection receives a factory instead, and both kinds answer the same
 * small interface — which is also what lets a manager read through a nested collection without
 * asking what kind it is.
 */
import type { MdyCollectionHost } from "./collection-host.js";
import type {
  MdyAnyArrayDescriptor,
  MdyAnyFieldDescriptor,
  MdyAnyGroupDescriptor,
  MdyAnyRecordDescriptor,
} from "./descriptors.js";
import type { MdyReactivity } from "../reactivity-contract.js";

/** The two collections a schema can declare. */
export type MdyCollectionKind = "record" | "array";

/** Everything a manager needs to own one collection, whoever declared it. */
export interface MdyCollectionDeps {
  readonly rx: MdyReactivity;
  readonly engine: MdyCollectionHost;
  /** Dotted path of the collection itself, e.g. "rows" or "orders.o1.lines". */
  readonly path: string;
  readonly item:
    | MdyAnyFieldDescriptor
    | MdyAnyGroupDescriptor
    | MdyAnyRecordDescriptor
    | MdyAnyArrayDescriptor;
  /** The host's development channel, so `devWarnings: false` silences these too. */
  readonly warn: (message: string) => void;
  /**
   * The conditions of the sections this collection sits under, the enclosing row's own declaration
   * included: a collection under something out of play is out of play with it.
   */
  readonly sections?: ReadonlyArray<() => boolean>;
  /**
   * True when a positional collection encloses this one — a path may cross one positional level
   * (ADR 0040), and only the enclosing collection knows whether it already has.
   */
  readonly positionalAncestor?: boolean;
  /** How to build a collection declared inside one of this collection's rows. */
  readonly createCollection: MdyCollectionFactory;
}

/**
 * A collection seen from the collection that owns it: enough to read its value, its leaves and the
 * collections below it, and to end it with the row that declared it.
 */
export interface MdyNestedCollection {
  readonly collectionKind: MdyCollectionKind;
  /** Every leaf path of every declared row — what an enclosing collection treats as its fields. */
  leafPathsNow(): string[];
  /** The rows as a value: an array for a positional collection, an object for a keyed one. */
  getValues(): unknown;
  /** Replaces the rows wholesale; a value of the wrong shape says nothing and changes nothing. */
  setAllFrom(value: unknown): void;
  /**
   * Writes what a patch names and leaves the rest of each row as it is.
   *
   * The difference from {@link MdyNestedCollection.setAllFrom} is the cells a row does *not* name: a
   * replacement gives them the declaration's initial, which is what a row built from nothing gets,
   * while a patch leaves what is there. Which rows exist is still the value's own statement in both.
   */
  patchFrom(value: unknown): void;
  /**
   * The path of every collection declared below this one, its own excluded.
   *
   * A collection registers a field at its own path so that errors attributed to the collection have
   * somewhere to surface. That field is not a leaf, so a caller tearing this subtree down by its
   * leaves alone leaves it behind — and a field under a row keeps the row alive for the
   * reconciliation, which reads it back as a row holding nothing.
   */
  collectionPathsNow(): string[];
  /** The manager for a collection declared below this one, wherever it sits. */
  nested(path: string): MdyNestedCollection | undefined;
  destroy(): void;
}

/** Builds the manager for a collection declared inside a row. */
export type MdyCollectionFactory = (
  kind: MdyCollectionKind,
  deps: MdyCollectionDeps,
  value: unknown,
) => MdyNestedCollection;
