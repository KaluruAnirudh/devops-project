import { useState } from "react";

const initialState = {
  email: "",
  password: ""
};

export const LoginPage = ({ onSubmit, onSwitch, busy, error }) => {
  const [form, setForm] = useState(initialState);

  return (
    <div className="auth-shell">
      <section className="hero-panel">
        <p className="eyebrow">CI/CD Automation Platform</p>
        <h1>Ship changes through resilient pipelines, not manual checklists.</h1>
        <p>
          The platform orchestrates GitHub, Jenkins, Docker, and Kubernetes so teams
          can move from commit to verified deployment with rollback protection built in.
        </p>
      </section>

      <section className="auth-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Sign in</p>
            <h2>Welcome back</h2>
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
              placeholder="Enter your password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              required
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button className="primary-button" disabled={busy}>
            {busy ? "Signing in..." : "Login"}
          </button>
        </form>

        <button className="text-button" onClick={onSwitch}>
          Need an account? Register
        </button>
      </section>
    </div>
  );
};

