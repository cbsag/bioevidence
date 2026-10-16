import type { Metadata } from "next";
import Link from "next/link";

import { createAccountWithEmail, signInWithGoogle } from "@/app/auth/actions";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create a BioEvidence AI account.",
};

type SignUpPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const params = await searchParams;
  const message = firstValue(params.message);
  const error = firstValue(params.error);

  return (
    <main className="auth-page">
      <section className="shell auth-layout">
        <div className="auth-copy">
          <span>Create account</span>
          <h1>Create a BioEvidence account.</h1>
          <p>
            Set up your workspace profile so BioEvidence can organize answers,
            evidence review, and access preferences around your role.
          </p>
          <Link href="/docs/introduction">Read the product overview</Link>
        </div>

        <div className="auth-panel">
          {message ? <p className="auth-alert success">{message}</p> : null}
          {error ? <p className="auth-alert error">{error}</p> : null}
          <form action={signInWithGoogle}>
            <input type="hidden" name="next" value="/account/profile" />
            <button type="submit">Continue with Google</button>
          </form>
          <div className="auth-divider">or</div>
          <form action={createAccountWithEmail}>
            <input type="hidden" name="next" value="/account/profile" />
          <label>
            <span>Full name</span>
              <input name="full_name" placeholder="Your name" />
          </label>
          <label>
            <span>Email</span>
              <input name="email" placeholder="you@example.com" type="email" />
          </label>
          <label>
            <span>Primary role</span>
              <select name="role" defaultValue="">
              <option value="" disabled>
                Select role
              </option>
              <option>Researcher</option>
              <option>Engineer</option>
              <option>Clinician</option>
              <option>Student</option>
              <option>Evaluator</option>
            </select>
          </label>
            <button type="submit">
            Create account
          </button>
          </form>
          <p>
            Already invited? <Link href="/signin">Sign in</Link>.
          </p>
        </div>
      </section>
    </main>
  );
}
