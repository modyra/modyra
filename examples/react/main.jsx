// Demo React: consumes @modyra/react from node_modules (the built package).
import { createRoot } from "react-dom/client";
import { field, required, useMdyField, useMdyForm } from "@modyra/react";

function Signup() {
  const form = useMdyForm(() => ({ email: field("", [required()]) }));
  const email = useMdyField(form.f.email);
  return (
    <form onSubmit={(e) => { e.preventDefault(); void form.submit((v) => console.log(v)); }}>
      <label>
        Email
        <input value={email.value} onChange={(e) => email.set(e.target.value)}
               onBlur={email.markAsTouched} aria-invalid={!email.valid} />
      </label>
      {email.touched && email.errors.map((er) => <p key={er.message}>{er.message}</p>)}
      <button type="submit">Sign up</button>
    </form>
  );
}
createRoot(document.getElementById("app")).render(<Signup />);
