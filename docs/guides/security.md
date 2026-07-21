# Injection prevention

Modyra never renders field values as HTML (see [SECURITY.md](../../SECURITY.md))
— but values still flow into places where invisible or markup characters do
damage: confirmation emails, PDF exports, logs, CSV downloads, downstream
systems that *do* render HTML, and UI-spoofing tricks based on bidi or
zero-width characters (`"admin\u202E"` looks like `admin` but isn't).

The `security` option adds a prevention layer **inside the engine**, at the
single point every write passes through — the field's value signal. User
input, `patch()`/`setValue()`, draft restore, array `push`/`insert` and
bindings writing the signal directly are all covered by construction: there
is no path around it.

```ts
import { createForm, field } from "@modyra/core";

const form = createForm(
  {
    name: field(""),
    bio: field(""),
    code: field("", [], { sanitize: "off" }),   // per-field exemption
    html: field("", [], { sanitize: domPurify }), // per-field custom
  },
  {
    security: {
      sanitize: "text",          // form-level default profile
      maxValueLength: 10_000,    // truncate longer strings
      onViolation: (v) => telemetry(v), // telemetry hook
    },
  },
);
```

The same options exist on `mdyForm()` (Angular), `useForm()` (React),
`useForm()`/`createForm()` (Vue) and the Lit adapter — the policy lives in
the shared core.

## Sanitization profiles

| Profile | What it does |
| :------ | :----------- |
| `"off"` (default) | Values pass through untouched. |
| `"text"` | Strips control characters (except `\t`/`\n`), DEL/C1, zero-width characters (`U+200B–200D`, `U+FEFF`), bidi overrides/isolates (`U+202A–202E`, `U+2066–2069`) and line/paragraph separators. Prevents UI spoofing and log/CSV injection; all legitimate text — accents, emoji, CJK, newlines — is preserved. |
| `"strict"` | Everything `"text"` does, plus removes `<`, `` ` `` and `>`. The value can never form markup. For names, labels and identifiers that must stay plain text everywhere. Quotes and `&` stay: `O'Brien & Co` is a legitimate name. |
| function | Full control: receives the whole field value, returns the sanitized one. Must be **pure and idempotent** (it runs on every write). This is the DOMPurify/allow-list escape hatch — the core stays dependency-free on purpose. |

Resolution order per field: `field(..., { sanitize })` →
`security.sanitize` → `"off"`.

Sanitization is **deep**: strings inside plain objects and arrays in the
field value (multi-selects, object-valued fields) are processed too, and
`maxValueLength` applies to every string found. Values that can't carry
text (`File`, `Date`, class instances) are never touched. When nothing
changes, the original reference is returned so signal identity checks keep
working.

## Violation telemetry

Every interception is reported to `onViolation`:

```ts
interface MdySecurityViolation {
  kind: "sanitized" | "max-length" | "draft-shape" | "error-path";
  path: string;   // dotted field path
  detail: string; // human-readable, for logs
}
```

Errors thrown by the hook are swallowed (surfaced as dev warnings) — a
faulty telemetry pipeline can never break a form.

## Always-on structural checks

These are not configurable: they only ever drop data the form itself could
never have produced.

- **Draft shape validation.** A stored draft is untrusted input
  (`localStorage` is writable by any script on the origin). On restore,
  each entry is checked against the field's declared type: an object
  restored into a `number` field, an array into a `string` field, or
  anything into a `File` field is dropped and reported (`draft-shape`)
  instead of causing type confusion downstream. `null` is always allowed
  (Modyra's empty sentinel). Fields without a declared initial (raw-engine
  usage, where drafts legitimately create fields) restore as-is.
- **Server-error path validation.** Errors returned by the submit action
  with prototype-polluting paths (`__proto__` and friends) are dropped and
  reported (`error-path`). Errors with unknown-but-safe paths keep the
  existing behavior (surfaced at `errorsFor("")`).
- **Path safety** (pre-existing): field paths are validated at creation —
  `__proto__`, `prototype`, `constructor` and empty segments are rejected
  everywhere paths enter (fields, drafts, dynamic config).

## Choosing a posture

- **Opt-in (0.x default):** `sanitize` defaults to `"off"` — zero behavior
  change for existing forms. The structural checks above are always active.
- **Recommended for new apps:** `sanitize: "text"` form-wide. It is
  invisible to legitimate users and kills the entire invisible-character
  class of problems. Exempt fields that legitimately need arbitrary bytes
  (code editors, rich text) with `field(..., { sanitize: "off" })` or a
  custom function.
- **High-risk surfaces** (values re-rendered as HTML downstream, AI-
  generated forms, public intake): `"strict"` on identity fields plus
  `maxValueLength`; a custom sanitizer (e.g. DOMPurify) on rich-text
  fields. For AI-generated forms see the
  [AI-generated forms guide](ai-generated-forms.md): a form-level policy
  automatically covers every field the LLM declares.
- **Secure by default at 1.0:** the default profile is planned to flip to
  `"text"` in the next major. The changelog will call it out.

## Trust model: option whitelisting and anti-tampering

"If the select offers `one` and `two`, `three` must not be accepted."
Two different defenses answer that, and both ship with Modyra:

**Client-side (UX + first line).** The `oneOf`/`eachOneOf` validators
whitelist a field's value against the allowed options:

```ts
import { field, oneOf, eachOneOf, required } from "@modyra/core";

const form = createForm({
  plan: field(null, [required(), oneOf(["one", "two"])]),
  tags: field([], [eachOneOf(["a", "b"])]), // multiselect: every element
});
form.f.plan.set("three"); // scripted tampering → field invalid, submit gated
```

For option-based **dynamic fields** the whitelist is automatic:
`buildDynamicFieldValidators()` constrains `select`/`radio`/`segmented`
values and every `multiselect` element to the declared `options` — so a
CMS/LLM-generated form is tamper-resistant client-side with zero extra
code (see the [AI-generated forms guide](ai-generated-forms.md)).

**Server-side (the real boundary).** Client-side checks are
defense-in-depth, never proof: anything in the browser can be bypassed
with curl/Postman/DevTools. The honest anti-tampering story is the
*isomorphic* one — Modyra's engine runs in plain Node, so **one schema
can drive the form and gate the API**:

```ts
// shared/order-schema.ts — one schema, both sides
import { z } from "zod";
export const orderSchema = z.object({
  plan: z.enum(["one", "two"]),
  qty: z.number().int().min(1).max(10),
});

// client: schema-driven form (@modyra/zod)
import { createZodForm } from "@modyra/zod";
const form = createZodForm(orderSchema, { initial: { plan: "one", qty: 1 } });

// server: the SAME schema gates the payload
app.post("/order", (req, res) => {
  const result = orderSchema.safeParse(req.body);
  if (!result.success) return res.status(422).json(result.error.issues);
  // …accept
});
```

This exact flow is executable — a scripted `form.f.plan.set("three")` is
invalid client-side, and a forged `POST {"plan": "three"}` gets a 422
from `safeParse` (verified against the built packages in CI-adjacent
tests). Any Standard Schema library (valibot, arktype…) works the same
way via `@modyra/standard-schema`.

## What this is not

- **Not a substitute for output encoding.** Sanitization reduces what a
  value can carry; whoever renders or stores it still owns correct
  encoding/parameterization (Modyra's own renderers never use `innerHTML`).
- **Not validation.** A sanitized value is silently modified, not rejected.
  To *reject* suspicious input instead, keep using validators
  (`pattern()`, custom `ValidatorFn`) — the two compose: sanitize first
  (write path), validate the result (error path).
- **Not ReDoS protection.** `pattern()` executes the regex you give it;
  pathological expressions are a known, documented risk of the validator
  itself, independent of user input.
