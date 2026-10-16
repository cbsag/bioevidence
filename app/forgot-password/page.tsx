import type { Metadata } from "next";
import Link from "next/link";

import { sendAccountLink } from "@/app/auth/actions";

export const metadata: Metadata = {
  title: "Account Link",
  description: "Send a BioEvidence AI account sign-in link.",
};

type ForgotPasswordPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const params = await searchParams;
  const message = firstValue(params.message);
  const error = firstValue(params.error);

  return (
    <main className="auth-page compact">
      <section className="shell auth-layout">
        <div className="auth-copy">
          <span>Account recovery</span>
          <h1>Send an account link.</h1>
          <p>
            Enter your account email and BioEvidence will send a secure sign-in
            link.
          </p>
        </div>

        <form className="auth-panel" action={sendAccountLink}>
          {message ? <p className="auth-alert success">{message}</p> : null}
          {error ? <p className="auth-alert error">{error}</p> : null}
          <label>
            <span>Email</span>
            <input name="email" placeholder="you@example.com" type="email" />
          </label>
          <button type="submit">
            Send account link
          </button>
          <p>
            Remembered it? <Link href="/signin">Return to sign in</Link>.
          </p>
        </form>
      </section>
    </main>
  );
}
