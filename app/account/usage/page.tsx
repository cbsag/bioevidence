import type { Metadata } from "next";

import { AccountConsole } from "@/components/account-console";
import { requireAccount } from "@/lib/account";

export const metadata: Metadata = {
  title: "Usage",
  description: "BioEvidence AI usage and API access.",
};

export default async function AccountUsagePage() {
  const { counts, profile } = await requireAccount("/account/usage", { includeCounts: true });
  const usageRows = [
    ["Workspace searches", "Available", "Public access"],
    [
      "Advanced QA",
      profile.access_status === "approved" ? "Approved" : "Access request",
      "Controlled use",
    ],
    ["API keys", "Managed", "Upon approval"],
    [ "Saved answers", String(counts.savedAnswers), "Workspace feature"],
    ["Usage events", String(counts.usageEvents), "Account activity"],
  ];

  return (
    <AccountConsole
      active="/account/usage"
      title="Usage and access"
      description="Track account activity, access level, saved answers, and API availability."
      profile={profile}
    >
      <div className="account-table">
        {usageRows.map(([feature, status, note]) => (
          <div key={feature}>
            <strong>{feature}</strong>
            <span>{status}</span>
            <small>{note}</small>
          </div>
        ))}
      </div>
      <button className="account-disabled-action" type="button" disabled>
        Generate API key
      </button>
    </AccountConsole>
  );
}
