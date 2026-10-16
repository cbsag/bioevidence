import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import { encodeStatus } from "@/lib/auth-redirect";
import type { Database, Profile } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AccountCounts = {
  savedAnswers: number;
  savedQuestions: number;
  usageEvents: number;
};

export type AccountWorkspace = {
  counts: AccountCounts;
  profile: Profile;
  supabase: SupabaseClient<Database>;
  user: User;
};

function textFromMetadata(user: User, key: string): string | null {
  const value = user.user_metadata[key];
  return typeof value === "string" && value.trim() ? value : null;
}

export function fallbackProfile(user: User): Profile {
  const now = new Date().toISOString();

  return {
    access_status: "pending",
    avatar_url: textFromMetadata(user, "avatar_url"),
    created_at: now,
    email: user.email ?? null,
    full_name:
      textFromMetadata(user, "full_name") ??
      textFromMetadata(user, "name") ??
      null,
    id: user.id,
    organization: textFromMetadata(user, "organization"),
    role: textFromMetadata(user, "role"),
    updated_at: now,
    use_case: textFromMetadata(user, "use_case"),
  };
}

async function countUserRows(
  supabase: SupabaseClient<Database>,
  table: "saved_answers" | "saved_questions" | "usage_events",
  userId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) return 0;
  return count ?? 0;
}

export async function getOrCreateProfile(
  supabase: SupabaseClient<Database>,
  user: User,
): Promise<Profile> {
  const fallback = fallbackProfile(user);
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (data) return data;

  const { data: inserted } = await supabase
    .from("profiles")
    .upsert(fallback, { onConflict: "id" })
    .select("*")
    .maybeSingle();

  return inserted ?? fallback;
}

export async function requireAccount(
  nextPath: string,
  options: { includeCounts?: boolean } = {},
): Promise<AccountWorkspace> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/signin?next=${encodeURIComponent(nextPath)}`);
  }

  try {
    const [profile, counts] = await Promise.all([
      getOrCreateProfile(supabase, user),
      options.includeCounts
        ? Promise.all([
            countUserRows(supabase, "saved_questions", user.id),
            countUserRows(supabase, "saved_answers", user.id),
            countUserRows(supabase, "usage_events", user.id),
          ])
        : Promise.resolve([0, 0, 0]),
    ]);
    const [savedQuestions, savedAnswers, usageEvents] = counts;

    return {
      counts: {
        savedAnswers,
        savedQuestions,
        usageEvents,
      },
      profile,
      supabase,
      user,
    };
  } catch {
    redirect(
      `/signin?error=${encodeStatus(
        "Account tables are not ready. Run the Supabase SQL migration first.",
      )}`,
    );
  }
}
