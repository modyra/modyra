# @modyra/vue

Vue binding for the [Modyra](https://github.com/modyra/modyra) form engine:
`vueReactivity()` implements the core's reactive contract on
`@vue/reactivity` (shallowRef/computed/effect), so form state participates
in Vue reactivity natively.

```ts
import { createVueForm, field, required } from "@modyra/vue";

const form = createVueForm({ email: field("", [required()]) });
// form.f.email.value() / errors() react inside computed(), watchers, templates
```

Status: early (0.1.0) — the reactivity binding and typed form factory are
implemented and tested; ready-made Vue components are future work.
