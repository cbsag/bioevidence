import { type NextRequest, NextResponse } from "next/server";

import { jsonError, requireWorkerSecret } from "@/lib/live-qa";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("Sign in to view worker status.", 401);

  const admin = createSupabaseAdminClient();
  const { data: worker, error } = await admin
    .from("qa_workers")
    .select("*")
    .order("last_seen_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return jsonError(error.message, 500);

  const lastSeen = worker ? new Date(worker.last_seen_at).getTime() : 0;
  return NextResponse.json({
    online: Boolean(worker && Date.now() - lastSeen < 45_000 && worker.status !== "offline"),
    worker,
  });
}

export async function POST(request: NextRequest) {
  const authError = requireWorkerSecret(request);
  if (authError) return authError;
  const payload = (await request.json().catch(() => null)) as {
    currentJobId?: string | null;
    errorMessage?: string | null;
    metadata?: Json;
    status?: string;
    workerId?: string;
  } | null;
  if (!payload?.workerId) return jsonError("workerId is required.");

  const allowedStatuses = new Set(["online", "busy", "error", "offline"]);
  const status = allowedStatuses.has(payload.status ?? "")
    ? (payload.status ?? "online")
    : "online";
  const admin = createSupabaseAdminClient();
  const { data: worker, error } = await admin
    .from("qa_workers")
    .upsert(
      {
        current_job_id: payload.currentJobId ?? null,
        error_message: payload.errorMessage ?? null,
        last_seen_at: new Date().toISOString(),
        metadata: payload.metadata ?? {},
        status,
        worker_id: payload.workerId,
      },
      { onConflict: "worker_id" },
    )
    .select("*")
    .single();
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ worker });
}
