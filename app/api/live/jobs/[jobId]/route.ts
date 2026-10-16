import { NextResponse } from "next/server";

import { jsonError } from "@/lib/live-qa";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type JobRouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function GET(_request: Request, context: JobRouteContext) {
  const { jobId } = await context.params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError("Sign in to view BioEvidence jobs.", 401);
  }

  const { data: job, error: jobError } = await supabase
    .from("qa_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (jobError) {
    return jsonError(jobError.message, 500);
  }

  if (!job) {
    return jsonError("BioEvidence job was not found.", 404);
  }

  const [eventsResult, sourcesResult] = await Promise.all([
    supabase
      .from("qa_events")
      .select("*")
      .eq("job_id", jobId)
      .order("sequence", { ascending: true }),
    supabase
      .from("qa_sources")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true }),
  ]);

  if (eventsResult.error) {
    return jsonError(eventsResult.error.message, 500);
  }

  if (sourcesResult.error) {
    return jsonError(sourcesResult.error.message, 500);
  }

  return NextResponse.json({
    events: eventsResult.data ?? [],
    job,
    sources: sourcesResult.data ?? [],
  });
}
