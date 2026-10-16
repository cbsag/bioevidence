import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { requestAccess } from "@/app/auth/actions";
import { fallbackProfile, getOrCreateProfile } from "@/lib/account";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Request Access",
  description: "Request access to BioEvidence AI.",
};

type RequestAccessPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function RequestAccessPage({
  searchParams,
}: RequestAccessPageProps) {
  const params = await searchParams;
  const message = firstValue(params.message);
  const error = firstValue(params.error);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user
    ? await getOrCreateProfile(supabase, user).catch(() => fallbackProfile(user))
    : null;

  return (
    <main className="auth-page">
      <section className="shell auth-layout">
        <div className="auth-copy">
          <span>Access</span>
          <h1>Request access to BioEvidence AI.</h1>
          <p>
            Tell me who you are and how you want to use BioEvidence. I use
            access requests to prioritize the right research and product
            workflows.
          </p>
          <Link href="/docs/roadmap">
            View roadmap
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>

        <form className="auth-panel" action={requestAccess}>
          {message ? <p className="auth-alert success">{message}</p> : null}
          {error ? <p className="auth-alert error">{error}</p> : null}
          <label>
            <span>Name</span>
            <input
              name="full_name"
              placeholder="Ganesh Chandrasekar"
              defaultValue={profile?.full_name ?? ""}
            />
          </label>
          <label>
            <span>Email</span>
            <input
              name="email"
              placeholder="you@example.com"
              type="email"
              defaultValue={profile?.email ?? ""}
            />
          </label>
          <label>
            <span>Organization or role</span>
            <input
              name="organization"
              placeholder="University, lab, company, or independent"
              defaultValue={profile?.organization ?? ""}
            />
          </label>
          <label>
            <span>Role</span>
            <input
              name="role"
              placeholder="Researcher, engineer, clinician, student..."
              defaultValue={profile?.role ?? ""}
            />
          </label>
          <label>
            <span>Use case</span>
            <textarea
              name="use_case"
              placeholder="Tell me what you want to evaluate or build with BioEvidence."
              defaultValue={profile?.use_case ?? ""}
            />
          </label>
          <button type="submit">
            Join request list
          </button>
          <p>I review requests personally and follow up when access is opened.</p>
        </form>
      </section>
    </main>
  );
}
