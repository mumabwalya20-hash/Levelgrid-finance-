"use client";

import { LockKeyhole } from "lucide-react";
import { type FormEvent, useState } from "react";
import type { OwnerAccess } from "./finance/owner-session";

export function OwnerSignIn({
  access,
  isOnline,
  signIn,
}: {
  access: Exclude<OwnerAccess, { screen: "finance" }>;
  isOnline: boolean | null;
  signIn: (email: string, password: string, trustDevice: boolean) => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || isOnline === false) return;
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    try {
      await signIn(String(form.get("email")).trim(), String(form.get("password")), form.has("trustDevice"));
    } finally {
      setSubmitting(false);
    }
  }

  if (access.screen === "checking") {
    return <p className="auth-status" role="status">Checking owner access…</p>;
  }

  if (access.screen === "setup") {
    return (
      <section className="auth-card" aria-labelledby="auth-title">
        <h2 id="auth-title">Sign-in setup</h2>
        <p className="form-help">Connect the Supabase project to enable Owner sign-in.</p>
      </section>
    );
  }

  return (
    <section className="auth-card" aria-labelledby="auth-title">
      <div className="auth-heading">
        <span className="record-icon"><LockKeyhole size={19} aria-hidden="true" /></span>
        <h2 id="auth-title">Owner sign-in</h2>
      </div>
      <form className="finance-form" onSubmit={submit}>
        <label className="form-field">
          <span>Email</span>
          <input name="email" type="email" autoComplete="username" autoCapitalize="none" required />
        </label>
        <label className="form-field">
          <span>Password</span>
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <label className="device-trust">
          <input name="trustDevice" type="checkbox" />
          <span>Trust this device for offline access</span>
        </label>
        {access.screen === "sign-in" && access.message && (
          <p className="form-feedback" role="status">{access.message}</p>
        )}
        {isOnline === false && <p className="form-help">Go online to sign in.</p>}
        <button className="action action-primary" type="submit" disabled={submitting || isOnline === false}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </section>
  );
}
