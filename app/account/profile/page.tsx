import type { Metadata } from "next";

import { updateProfile } from "@/app/auth/actions";
import { AccountConsole } from "@/components/account-console";
import { requireAccount } from "@/lib/account";

export const metadata: Metadata = {
  title: "Profile",
  description: "BioEvidence AI user profile settings.",
};

type AccountProfilePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function AccountProfilePage({
  searchParams,
}: AccountProfilePageProps) {
  const { profile } = await requireAccount("/account/profile");
  const params = await searchParams;
  const message = firstValue(params.message);
  const error = firstValue(params.error);

  return (
    <AccountConsole
      active="/account/profile"
      title="User profile"
      description="Keep your role, organization, and use case attached to your BioEvidence workspace."
      profile={profile}
    >
      <form className="account-form" action={updateProfile}>
        {message ? <p className="auth-alert success">{message}</p> : null}
        {error ? <p className="auth-alert error">{error}</p> : null}
        <label>
          <span>Display name</span>
          <input
            name="full_name"
            placeholder="Ganesh Chandrasekar"
            defaultValue={profile.full_name ?? ""}
          />
        </label>
        <label>
          <span>Email</span>
          <input
            placeholder="you@example.com"
            readOnly
            type="email"
            value={profile.email ?? ""}
          />
        </label>
        <label>
          <span>Organization</span>
          <input
            name="organization"
            placeholder="University, lab, company, or independent"
            defaultValue={profile.organization ?? ""}
          />
        </label>
        <label>
          <span>Role</span>
          <input
            name="role"
            placeholder="Researcher, engineer, clinician, student..."
            defaultValue={profile.role ?? ""}
          />
        </label>
        <label>
          <span>Primary use case</span>
          <textarea
            name="use_case"
            placeholder="Research review, biomedical QA evaluation, product testing..."
            defaultValue={profile.use_case ?? ""}
          />
        </label>
        <button type="submit">
          Save profile
        </button>
      </form>
    </AccountConsole>
  );
}
