import { type NextRequest, NextResponse } from "next/server";

import {
  jsonError,
  requireWorkerSecret,
  type LiveQASourceInput,
  type WorkerJobPatch,
} from "@/lib/live-qa";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

type WorkerJobRouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeSources(
  jobId: string,
  userId: string,
  sources: LiveQASourceInput[] | undefined,
): Database["public"]["Tables"]["qa_sources"]["Insert"][] {
  if (!Array.isArray(sources)) return [];

  const seen = new Set<string>();
  return sources
    .filter((source) => source && typeof source.source_id === "string")
    .map((source) => ({
      job_id: jobId,
      journal: source.journal ?? null,
      metadata: source.metadata ?? {},
      pmid: source.pmid?.trim() || null,
      publication_year: source.publication_year ?? null,
      source_id: source.source_id.trim(),
      source_type: source.source_type ?? "pubmed",
      snippet: source.snippet ?? null,
      title: source.title ?? null,
      url: source.url ?? null,
      user_id: userId,
    }))
    .filter((source) => {
      const key = `${source.source_type}:${source.source_id}`;
      if (!source.source_id || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export async function PATCH(request: NextRequest, context: WorkerJobRouteContext) {
  const authError = requireWorkerSecret(request);
  if (authError) return authError;

  const { jobId } = await context.params;
  const payload = (await request.json().catch(() => null)) as WorkerJobPatch | null;

  if (!isObject(payload)) {
    return jsonError("Provide a worker update payload.");
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

  const { data: job, error: jobError } = await admin
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

  const sourceRows = normalizeSources(job.id, job.user_id, payload.sources);
  if (sourceRows.length) {
    const { error: sourceError } = await admin
      .from("qa_sources")
      .upsert(sourceRows, { onConflict: "job_id,source_type,source_id" });

    if (sourceError) {
      return jsonError(sourceError.message, 500);
    }
  }

  let event = null;
  if (payload.event) {
    const { count } = await admin
      .from("qa_events")
      .select("id", { count: "exact", head: true })
      .eq("job_id", job.id);

    const { data: insertedEvent, error: eventError } = await admin
      .from("qa_events")
      .insert({
        detail: payload.event.detail ?? null,
        job_id: job.id,
        payload: payload.event.payload ?? {},
        sequence: (count ?? 0) + 1,
        stage: payload.event.stage,
        status: payload.event.status ?? "running",
        title: payload.event.title,
        user_id: job.user_id,
      })
      .select("*")
      .single();

    if (eventError) {
      return jsonError(eventError.message, 500);
    }

    event = insertedEvent;
  }

  const now = new Date().toISOString();
  const updates: Database["public"]["Tables"]["qa_jobs"]["Update"] = {
    last_event_at: now,
  };

  if (payload.status) {
    updates.status = payload.status;
  }

  if (typeof payload.answerText === "string" || payload.answerText === null) {
    updates.answer_text = payload.answerText;
  }

  if (payload.answerCitations !== undefined) {
    updates.answer_citations = payload.answerCitations;
  }

  if (typeof payload.errorMessage === "string" || payload.errorMessage === null) {
    updates.error_message = payload.errorMessage;
  }

  if (payload.status === "completed" || payload.status === "failed") {
    updates.completed_at = now;
  }

  const { data: updatedJob, error: updateError } = await admin
    .from("qa_jobs")
    .update(updates)
    .eq("id", job.id)
    .select("*")
    .single();

  if (updateError) {
    return jsonError(updateError.message, 500);
  }

  return NextResponse.json({
    event,
    job: updatedJob,
    sources: sourceRows.length,
  });
}
