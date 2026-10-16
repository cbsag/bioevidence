import { type NextRequest, NextResponse } from "next/server";

import { jsonError, requireWorkerSecret } from "@/lib/live-qa";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = requireWorkerSecret(request);
  if (authError) return authError;

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Live QA is not configured.",
      503,
    );
  }

  const workerId =
    request.nextUrl.searchParams.get("worker_id")?.trim().slice(0, 80) ??
    "bioevidence-worker";
  const { data, error } = await admin.rpc("claim_next_qa_job", {
    worker_identity: workerId,
  });

  if (error) {
    return jsonError(error.message, 500);
  }

  return NextResponse.json({ job: data?.[0] ?? null });
}
