/**
 * `structuredClone` is a Node/browser global (not DOM-specific), but its
 * ambient type in @types/node pulls in lib.dom types we deliberately don't
 * include here (tsconfig has no "DOM" lib — enforces the P2 "no DOM" gate
 * at the type level). Declare the minimal shape we use instead.
 */
declare function structuredClone<T>(value: T): T;
