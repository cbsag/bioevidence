import { type NextRequest, NextResponse } from "next/server";

import {
  jsonError,
  liveQASystemId,
  normalizeQuestion,
  questionError,
} from "@/lib/live-qa";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError("Sign in to view BioEvidence jobs.", 401);
  }

  const { data, error } = await supabase
    .from("qa_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    return jsonError(error.message, 500);
  }

  return NextResponse.json({ jobs: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError("Sign in to ask BioEvidence.", 401);
  }

  const payload = (await request.json().catch(() => null)) as
    | { question?: unknown; systemId?: unknown }
    | null;
  const question = normalizeQuestion(payload?.question);
  const validationError = questionError(question);

  if (validationError) {
    return jsonError(validationError);
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Live QA is not configured.",
      503,
    );
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("access_status")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.access_status === "blocked") {
    return jsonError("This account cannot create BioEvidence jobs.", 403);
  }

  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const dailyLimit = profile?.access_status === "approved" ? 50 : 8;
  const { count } = await admin
    .from("qa_jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", dayStart.toISOString());

  if ((count ?? 0) >= dailyLimit) {
    return jsonError("Daily BioEvidence question limit reached.", 429);
  }

  const systemId =
    typeof payload?.systemId === "string" && payload.systemId.trim()
      ? payload.systemId.trim().slice(0, 80)
      : liveQASystemId;

  const { data: job, error: jobError } = await admin
    .from("qa_jobs")
    .insert({
      input: {
        source: "web",
        user_agent: request.headers.get("user-agent"),
      },
      question,
      system_id: systemId,
      user_id: user.id,
    })
    .select("*")
    .single();

  if (jobError || !job) {
    return jsonError(jobError?.message ?? "Could not create BioEvidence job.", 500);
  }

  const { data: event } = await admin
    .from("qa_events")
    .insert({
      detail: "Your question is queued for BioEvidence.",
      job_id: job.id,
      payload: { system_id: systemId },
      sequence: 1,
      stage: "queued",
      status: "queued",
      title: "Question received",
      user_id: user.id,
    })
    .select("*")
    .single();

  await admin.from("usage_events").insert({
    event_type: "live_qa_job_created",
    metadata: { job_id: job.id, system_id: systemId },
    user_id: user.id,
  });

  return NextResponse.json({ event, job }, { status: 201 });
}
