import { useState } from "react";

const initialState = {
  name: "",
  email: "",
  password: ""
};

export const RegisterPage = ({ onSubmit, onSwitch, busy, error }) => {
  const [form, setForm] = useState(initialState);

  return (
    <div className="auth-shell">
      <section className="hero-panel">
        <p className="eyebrow">ForgeOps onboarding</p>
        <h1>Create a deployment command center for every repository you own.</h1>
        <p>
          Register once, connect GitHub, and let policy-driven automation handle build,
          test, image publishing, rollout verification, and rollback.
        </p>
      </section>

      <section className="auth-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Create account</p>
            <h2>Start automating</h2>
          </div>
        </div>

        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(form);
          }}
        >
          <label>
            Full name
            <input
              type="text"
              placeholder="Anirudh Kaluru"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
          </label>

          <label>
            Email
            <input
              type="email"
              placeholder="you@company.com"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              placeholder="Create a strong password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              required
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button className="primary-button" disabled={busy}>
            {busy ? "Creating account..." : "Register"}
          </button>
        </form>

        <button className="text-button" onClick={onSwitch}>
          Already have an account? Login
        </button>
      </section>
    </div>
  );
};

