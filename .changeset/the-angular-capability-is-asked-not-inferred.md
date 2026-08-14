---
"@modyra/angular": patch
---

`angularReactivity` asks whether effects can run, rather than inferring it from holding an injector

`capabilities.effects` was `injector !== undefined` — a proxy for the question rather than the
question. An injector created with no parent has no `ChangeDetectionScheduler`:

```ts
angularReactivity()                                // effects: false, degrades, warns — honest
angularReactivity(Injector.create({ providers: [] }))
                                                   // effects: TRUE, then NG0201 from inside
                                                   // Angular when the engine calls effect()
```

So the better-looking input produced the worse failure: no injector at all degrades honestly and
warns, while a detached one promises effects and raises a raw framework error from inside the
engine's own call.

It creates and destroys one effect at construction now. Measured, so the boundary is stated rather
than guessed: a parentless `Injector.create` raises, while `TestBed.inject(Injector)` and a
`createEnvironmentInjector` child of an application injector both run — this is reached by a detached
container rather than by anything `inject()` hands a component, which is why it is a small fix and
not an urgent one.

Same shape as `solidReactivity` probing its graph instead of matching a build: a capability that
answers about the thing it was given rather than about the shape of the argument.

Found by `@modyra/angular`'s battle sweep, which measured the failure and could not build the
known-good case from outside — the third injector kind needed a real application, which this
package's own suite has.
