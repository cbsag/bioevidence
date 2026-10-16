"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { encodeStatus, safeNextPath } from "@/lib/auth-redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function requestOrigin(): Promise<string> {
  const headerStore = await headers();
  return (
    headerStore.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000"
  );
}

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function signInWithGoogle(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const origin = await requestOrigin();
  const next = safeNextPath(formData.get("next"));
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data.url) {
    redirect(
      `/signin?error=${encodeStatus(
        error?.message ?? "Google sign in is not configured yet.",
      )}`,
    );
  }

  redirect(data.url);
}

export async function signInWithEmail(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const origin = await requestOrigin();
  const email = textValue(formData, "email");
  const next = safeNextPath(formData.get("next"));

  if (!email) {
    redirect("/signin?error=Email%20is%20required");
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      shouldCreateUser: false,
    },
  });

  if (error) {
    redirect(`/signin?error=${encodeStatus(error.message)}`);
  }

  redirect("/signin?message=Check%20your%20email%20for%20the%20sign-in%20link");
}

export async function createAccountWithEmail(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const origin = await requestOrigin();
  const email = textValue(formData, "email");
  const fullName = textValue(formData, "full_name");
  const role = textValue(formData, "role");
  const next = safeNextPath(formData.get("next"));

  if (!email) {
    redirect("/signup?error=Email%20is%20required");
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      data: {
        full_name: fullName || null,
        role: role || null,
      },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    redirect(`/signup?error=${encodeStatus(error.message)}`);
  }

  redirect("/signup?message=Check%20your%20email%20to%20finish%20account%20setup");
}

export async function sendAccountLink(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const origin = await requestOrigin();
  const email = textValue(formData, "email");

  if (!email) {
    redirect("/forgot-password?error=Email%20is%20required");
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/account`,
      shouldCreateUser: false,
    },
  });

  if (error) {
    redirect(`/forgot-password?error=${encodeStatus(error.message)}`);
  }

  redirect("/forgot-password?message=Check%20your%20email%20for%20the%20account%20link");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function updateProfile(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin?next=/account/profile");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: textValue(formData, "full_name") || null,
      organization: textValue(formData, "organization") || null,
      role: textValue(formData, "role") || null,
      use_case: textValue(formData, "use_case") || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    redirect(`/account/profile?error=${encodeStatus(error.message)}`);
  }

  revalidatePath("/account/profile");
  redirect("/account/profile?message=Profile%20saved");
}

export async function requestAccess(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = textValue(formData, "email") || (user?.email ?? "");
  const fullName = textValue(formData, "full_name");
  const organization = textValue(formData, "organization");
  const role = textValue(formData, "role");
  const useCase = textValue(formData, "use_case");

  if (!email) {
    redirect("/request-access?error=Email%20is%20required");
  }

  const { error } = await supabase.from("access_requests").insert({
    email,
    full_name: fullName || null,
    organization: organization || null,
    role: role || null,
    use_case: useCase || null,
    user_id: user?.id ?? null,
  });

  if (user) {
    await supabase
      .from("profiles")
      .update({
        full_name: fullName || null,
        organization: organization || null,
        role: role || null,
        use_case: useCase || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
  }

  if (error) {
    redirect(`/request-access?error=${encodeStatus(error.message)}`);
  }

  redirect("/request-access?message=Request%20received");
}
