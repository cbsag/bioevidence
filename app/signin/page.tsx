import type { Metadata } from "next";
import Link from "next/link";

import { signInWithEmail, signInWithGoogle } from "@/app/auth/actions";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to BioEvidence AI.",
};

type SignInPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const next = firstValue(params.next) || "/account";
  const message = firstValue(params.message);
  const error = firstValue(params.error);

  return (
    <main className="auth-page compact">
      <section className="shell auth-layout">
        <div className="auth-copy">
          <span>Sign in</span>
          <h1>Sign in to BioEvidence.</h1>
          <p>
            Continue with Google or use an email link for an existing
            BioEvidence account.
          </p>
          <Link href="/ask?mode=examples">Open example workspace</Link>
        </div>

        <div className="auth-panel">
          {message ? <p className="auth-alert success">{message}</p> : null}
          {error ? <p className="auth-alert error">{error}</p> : null}
          <form action={signInWithGoogle}>
            <input type="hidden" name="next" value={next} />
            <button type="submit">Continue with Google</button>
          </form>
          <div className="auth-divider">or</div>
          <form action={signInWithEmail}>
            <input type="hidden" name="next" value={next} />
          <label>
            <span>Account email</span>
              <input name="email" placeholder="you@example.com" type="email" />
          </label>
            <button type="submit">
              Send sign-in link
          </button>
          </form>
          <p>
            New to BioEvidence? <Link href="/request-access">Request access</Link>.
          </p>
          <Link href="/signup">Create account</Link>
        </div>
      </section>
    </main>
  );
}
