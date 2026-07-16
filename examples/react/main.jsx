// Demo React — same signup form as the Vue/Lit/Angular demos, Material theme.
import { createRoot } from "react-dom/client";
import { useEffect, useRef } from "react";
import {
  email, field, minLength, mountMdyDevtools, required,
  useMdyField, useMdyForm,
} from "@modyra/react";

function Field({ label, handle, type = "text" }) {
  const f = useMdyField(handle);
  const showErrors = f.touched && f.errors.length > 0;
  return (
    <div className={`mdy-renderer mdy-renderer--text${f.touched ? " mdy-renderer--touched" : ""}`}>
      <label className="mdy-label">{label}</label>
      <div className="mdy-input-wrapper">
        <input type={type} value={f.value ?? ""} aria-invalid={!f.valid}
               onChange={(e) => f.set(e.target.value)} onBlur={f.markAsTouched} />
      </div>
      {showErrors && (
        <ul className="mdy-control__errors" role="alert">
          {f.errors.map((er) => <li className="mdy-control__error" key={er.message}>{er.message}</li>)}
        </ul>
      )}
    </div>
  );
}

function Signup() {
  const form = useMdyForm(() => ({
    name: field("", [required(), minLength(2)]),
    email: field("", [required(), email()]),
  }));
  const devtools = useRef(null);
  useEffect(() => mountMdyDevtools(form, devtools.current), [form]);
  return (
    <main style={{ maxWidth: "28rem", margin: "2rem auto", display: "grid", gap: "1rem" }}>
      <h1>Modyra × React</h1>
      <form className="mdy-form" onSubmit={(e) => { e.preventDefault(); void form.submit((v) => console.log(v)); }}>
        <Field label="Name" handle={form.f.name} />
        <Field label="Email" handle={form.f.email} type="email" />
        <button type="submit">Sign up</button>
      </form>
      <div ref={devtools}></div>
    </main>
  );
}
createRoot(document.getElementById("app")).render(<Signup />);
