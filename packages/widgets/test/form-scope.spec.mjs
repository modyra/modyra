/**
 * The scope a form's ids sit in.
 *
 * [ADR 0146](../../../docs/architecture/0146-a-form-carries-its-own-scope.md): every form carries one
 * whether or not the consumer asked, because two forms built from one document otherwise claim one
 * set of ids and a reference from the second resolves into the first — silently, and against the
 * person being read the wrong form's text.
 *
 * Two properties pull in opposite directions and both are asserted here: the same document must
 * arrive at the same scope (a remount, a hydration), and two live forms must not share one. The
 * first comes from the document; the second cannot, because twins are identical by construction, so
 * it comes from a question only the caller can answer.
 */
import assert from "node:assert";
import test from "node:test";

import { createForm, field, vanillaReactivity } from "@modyra/core";

const build = () => createForm(
  { when: field(""), who: field("") },
  { reactivity: vanillaReactivity(), devWarnings: false },
);

test("one form has one scope, however many times it is asked", async () => {
  const { formScopeOf } = await import("../dist/index.js");
  const form = build();
  const first = formScopeOf(form);
  assert.equal(typeof first, "string");
  assert.ok(first.length > 0);
  assert.equal(formScopeOf(form), first, "a second reading minted a different scope");
  form.destroy();
});

test("the same document arrives at the same scope, mount after mount", async () => {
  const { formScopeOf } = await import("../dist/index.js");
  // The remount, and the client hydrating what a server rendered. A scope that moved here would move
  // every id on the page with it, and every relationship recorded against those ids stops meaning
  // anything — which is the property ADR 0135 established and this record keeps.
  const first = build();
  const scope = formScopeOf(first);
  first.destroy();

  const second = build();
  assert.equal(formScopeOf(second), scope, "the same document minted two scopes across a remount");
  second.destroy();
});

test("a different document is a different scope", async () => {
  const { formScopeOf } = await import("../dist/index.js");
  const two = createForm({ when: field(""), who: field("") }, { reactivity: vanillaReactivity(), devWarnings: false });
  const three = createForm(
    { when: field(""), who: field(""), where: field("") },
    { reactivity: vanillaReactivity(), devWarnings: false },
  );
  assert.notEqual(formScopeOf(two), formScopeOf(three));
  two.destroy();
  three.destroy();
});

test("two live forms built from one document do not share a scope", async () => {
  const { formScopeOf } = await import("../dist/index.js");
  const first = build();
  const firstScope = formScopeOf(first);

  // What the caller knows and the document cannot: this scope is already answering on the page. Only
  // a renderer that can see where it is mounting can say so, which is why it is asked rather than
  // derived — and why a renderer that mints an id before its element exists cannot close this case.
  const second = build();
  const secondScope = formScopeOf(second, (candidate) => candidate === firstScope);
  assert.notEqual(secondScope, firstScope);

  // And the answer is stable: the form holds the scope it was given, not the one it would ask for
  // again now.
  assert.equal(formScopeOf(second), secondScope);
  first.destroy();
  second.destroy();
});

test("a handle no form registered has no scope to offer", async () => {
  const { widgetScopeOf } = await import("../dist/index.js");
  // A hand-built handle is a documented shape — a test double, a consumer's own object. Inventing a
  // scope for it would move the ids of a page that used one, so it declines instead.
  assert.equal(widgetScopeOf({ path: "when" }), undefined);
  assert.equal(widgetScopeOf(null), undefined);
  assert.equal(widgetScopeOf(undefined), undefined);
});

test("a widget's scope is its form's, whichever field it is bound to", async () => {
  const { formScopeOf, widgetScopeOf } = await import("../dist/index.js");
  const form = build();
  // Every control of one form has to land on one scope, or a form's own label and control stop
  // pointing at each other — which is the failure the scope exists to prevent, arriving from inside.
  assert.equal(widgetScopeOf(form.f.when), formScopeOf(form));
  assert.equal(widgetScopeOf(form.f.who), formScopeOf(form));
  form.destroy();
});
