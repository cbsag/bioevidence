import type { Metadata } from "next";

import { AccountConsole } from "@/components/account-console";
import { requireAccount } from "@/lib/account";

export const metadata: Metadata = {
  title: "Settings",
  description: "BioEvidence AI account settings.",
};

const settings = [
  "Save completed answers to workspace",
  "Show process trail by default",
  "Require citation evidence before answer export",
  "Email product updates",
];

export default async function AccountSettingsPage() {
  const { profile } = await requireAccount("/account/settings");

  return (
    <AccountConsole
      active="/account/settings"
      title="Workspace settings"
      description="Set defaults for answer review, saved history, citation checks, and product updates."
      profile={profile}
    >
      <form className="account-settings-list">
        {settings.map((setting) => (
          <label key={setting}>
            <span>{setting}</span>
            <input type="checkbox" disabled />
          </label>
        ))}
        <button type="button" disabled>
          Save settings
        </button>
      </form>
    </AccountConsole>
  );
}
