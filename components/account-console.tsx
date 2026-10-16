import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  KeyRound,
  Settings,
  UserRound,
} from "lucide-react";

import { signOut } from "@/app/auth/actions";
import type { Profile } from "@/lib/supabase/database.types";

const accountLinks = [
  { href: "/account", label: "Overview", icon: Activity },
  { href: "/account/profile", label: "Profile", icon: UserRound },
  { href: "/account/usage", label: "Usage", icon: KeyRound },
  { href: "/account/settings", label: "Settings", icon: Settings },
];

type AccountConsoleProps = {
  active: string;
  title: string;
  description: string;
  profile: Profile;
  children: ReactNode;
};

export function AccountConsole({
  active,
  title,
  description,
  profile,
  children,
}: AccountConsoleProps) {
  const displayName = profile.full_name || profile.email || "Workspace";

  return (
    <main className="account-page">
      <div className="shell account-layout">
        <aside className="account-sidebar">
          <span>Account</span>
          <strong>{displayName}</strong>
          <p>
            {profile.email}
            <small>{profile.access_status}</small>
          </p>
          <nav aria-label="Account navigation">
            {accountLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  className={active === item.href ? "active" : ""}
                  href={item.href}
                  key={item.href}
                >
                  <Icon size={15} aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <form action={signOut}>
            <button type="submit">Sign out</button>
          </form>
        </aside>

        <section className="account-content">
          <div className="account-heading">
            <span>BioEvidence</span>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}
