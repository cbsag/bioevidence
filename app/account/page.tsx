import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { AccountConsole } from "@/components/account-console";
import { requireAccount } from "@/lib/account";

export const metadata: Metadata = {
  title: "Account",
  description: "BioEvidence AI account workspace.",
};

export default async function AccountPage() {
  const { counts, profile } = await requireAccount("/account", { includeCounts: true });

  return (
    <AccountConsole
      active="/account"
      title="Workspace overview"
      description="A single place for your BioEvidence profile, saved questions, usage visibility, and access settings."
      profile={profile}
    >
      <div className="account-card-grid">
        <article>
          <span>Access</span>
          <strong>{profile.access_status}</strong>
          <p>Your current workspace access level.</p>
        </article>
        <article>
          <span>Saved questions</span>
          <strong>{counts.savedQuestions}</strong>
          <p>Questions attached to your account.</p>
        </article>
        <article>
          <span>API access</span>
          <strong>{profile.access_status === "approved" ? "Managed" : "Request"}</strong>
          <p>Controlled access for higher-volume workflows.</p>
        </article>
      </div>
      <Link className="account-next" href="/account/profile">
        Continue to profile
        <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </AccountConsole>
  );
}
