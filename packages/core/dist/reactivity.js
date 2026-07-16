/**
 * Reactive contract the form engine is written against.
 *
 * The engine never imports a framework: it only needs something that can
 * create writable signals, derived computations and effects. Adapters bind
 * these to their host framework (Angular passes its native signals, so the
 * engine's state integrates with change detection); `vanillaReactivity()`
 * is a dependency-tracked implementation for Node, CLIs and plain unit
 * tests.
 */
let activeConsumer = null;
function track(producer) {
    if (activeConsumer) {
        producer.consumers.add(activeConsumer);
        activeConsumer.producers.add(producer);
    }
}
function dropDependencies(consumer) {
    for (const producer of consumer.producers) {
        producer.consumers.delete(consumer);
    }
    consumer.producers.clear();
}
class VanillaSignal {
    _value;
    consumers = new Set();
    constructor(_value) {
        this._value = _value;
    }
    read() {
        track(this);
        return this._value;
    }
    write(value) {
        if (Object.is(this._value, value))
            return;
        this._value = value;
        for (const consumer of [...this.consumers])
            consumer.markStale();
    }
}
class VanillaComputed {
    _fn;
    consumers = new Set();
    producers = new Set();
    _value;
    _dirty = true;
    constructor(_fn) {
        this._fn = _fn;
    }
    markStale() {
        if (this._dirty)
            return;
        this._dirty = true;
        for (const consumer of [...this.consumers])
            consumer.markStale();
    }
    read() {
        track(this);
        if (this._dirty) {
            dropDependencies(this);
            const prev = activeConsumer;
            activeConsumer = this;
            try {
                this._value = this._fn();
            }
            finally {
                activeConsumer = prev;
            }
            this._dirty = false;
        }
        return this._value;
    }
}
class VanillaEffect {
    _fn;
    producers = new Set();
    _scheduled = false;
    _destroyed = false;
    _cleanups = [];
    constructor(_fn) {
        this._fn = _fn;
        this._run();
    }
    markStale() {
        if (this._scheduled || this._destroyed)
            return;
        this._scheduled = true;
        queueMicrotask(() => {
            this._scheduled = false;
            if (!this._destroyed)
                this._run();
        });
    }
    _run() {
        this._runCleanups();
        dropDependencies(this);
        const prev = activeConsumer;
        activeConsumer = this;
        try {
            this._fn((cleanup) => this._cleanups.push(cleanup));
        }
        finally {
            activeConsumer = prev;
        }
    }
    _runCleanups() {
        const cleanups = this._cleanups;
        this._cleanups = [];
        for (const cleanup of cleanups)
            cleanup();
    }
    destroy() {
        if (this._destroyed)
            return;
        this._destroyed = true;
        this._runCleanups();
        dropDependencies(this);
    }
}
/**
 * Standalone reactive engine: dependency-tracked signals, lazy cached
 * computeds and microtask-batched effects. Enough to run the whole form
 * engine outside any framework — the "decisive test":
 *
 * ```ts
 * const form = createForm({ email: field("") });
 * form.f.email.set("foo@bar.com");
 * console.log(form.f.email.errors());
 * ```
 *
 * works in Node with no framework installed. Await a microtask
 * (`await Promise.resolve()`) after writes when asserting on
 * effect-driven state (async validators, drafts, history).
 */
export function vanillaReactivity() {
    return {
        canEffect: true,
        signal(initial) {
            const node = new VanillaSignal(initial);
            const read = (() => node.read());
            read.set = (value) => node.write(value);
            read.update = (fn) => node.write(fn(untrackedRead(() => node.read())));
            read.asReadonly = () => () => node.read();
            return read;
        },
        computed(fn) {
            const node = new VanillaComputed(fn);
            return () => node.read();
        },
        effect(fn) {
            const node = new VanillaEffect(fn);
            return { destroy: () => node.destroy() };
        },
        untracked: untrackedRead,
    };
}
function untrackedRead(fn) {
    const prev = activeConsumer;
    activeConsumer = null;
    try {
        return fn();
    }
    finally {
        activeConsumer = prev;
    }
}
