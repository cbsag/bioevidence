import { NextResponse, type NextRequest } from "next/server";

import type { Database, QAEventStatus, QAJobStatus } from "@/lib/supabase/database.types";

export const liveQASystemId = "bioevidence-live-v1";
export const maxQuestionLength = 800;

export type LiveQAEventInput = {
  detail?: string | null;
  payload?: Database["public"]["Tables"]["qa_events"]["Insert"]["payload"];
  stage: string;
  status?: QAEventStatus;
  title: string;
};

export type LiveQASourceInput = {
  journal?: string | null;
  metadata?: Database["public"]["Tables"]["qa_sources"]["Insert"]["metadata"];
  pmid?: string | null;
  publication_year?: string | null;
  source_id: string;
  source_type?: "pubmed" | "europe_pmc" | "clinical_trials";
  snippet?: string | null;
  title?: string | null;
  url?: string | null;
};

export type WorkerJobPatch = {
  answerCitations?: Database["public"]["Tables"]["qa_jobs"]["Update"]["answer_citations"];
  answerText?: string | null;
  errorMessage?: string | null;
  event?: LiveQAEventInput;
  sources?: LiveQASourceInput[];
  status?: QAJobStatus;
};

export function normalizeQuestion(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export function questionError(question: string): string | null {
  if (!question) return "Question is required.";
  if (question.length < 8) return "Ask a fuller biomedical question.";
  if (question.length > maxQuestionLength) {
    return `Questions must be ${maxQuestionLength} characters or fewer.`;
  }
  return null;
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function requireWorkerSecret(request: NextRequest): NextResponse | null {
  const expected = process.env.LIVE_QA_WORKER_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  const provided = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!expected) {
    return jsonError("Worker secret is not configured.", 503);
  }

  if (!provided || provided !== expected) {
    return jsonError("Worker authorization failed.", 401);
  }

  return null;
}
