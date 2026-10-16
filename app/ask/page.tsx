import type { Metadata } from "next";
import Link from "next/link";

import { BioEvidenceSearch } from "@/components/bioevidence-search";
import { LiveQAWorkspace } from "@/components/live-qa-workspace";
import { requireAccount } from "@/lib/account";
import { loadBioEvidenceSample } from "@/lib/bioevidence-sample";
import { findSampleSystem, findSampleTopic } from "@/lib/bioevidence-utils";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Ask",
  description: "Ask BioEvidence AI live or inspect saved evidence examples.",
};

type AskPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function modeHref(mode: "live" | "examples", question: string) {
  const params = new URLSearchParams({ mode });
  if (question) params.set("question", question);
  return `/ask?${params.toString()}`;
}

function AskModeTabs({
  activeMode,
  question,
}: {
  activeMode: "live" | "examples";
  question: string;
}) {
  return (
    <nav className="ask-mode-tabs" aria-label="Ask workspace mode">
      <Link
        className={activeMode === "live" ? "active" : ""}
        href={modeHref("live", question)}
      >
        <strong>Live</strong>
        <span>Ask a live biomedical question</span>
      </Link>
      <Link
        className={activeMode === "examples" ? "active" : ""}
        href={modeHref("examples", question)}
      >
        <strong>Examples</strong>
        <span>Explore saved evidence traces</span>
      </Link>
    </nav>
  );
}

export default async function AskPage({ searchParams }: AskPageProps) {
  const params = await searchParams;
  const initialQuestion = firstValue(params.question).slice(0, 800);
  const activeMode =
    firstValue(params.mode) === "examples" ? "examples" : "live";

  if (activeMode === "examples") {
    const sample = loadBioEvidenceSample();
    const requestedTopicId =
      firstValue(params.topic) || sample.demo_defaults.topic_id;
    const requestedSystemId =
      firstValue(params.system) || sample.demo_defaults.system_id;
    const topic = findSampleTopic(sample, requestedTopicId);
    const system = findSampleSystem(sample, requestedSystemId);

    return (
      <main className="ask-page ask-examples-page trace-page trace-run-page">
        <div className="shell ask-mode-shell">
          <AskModeTabs activeMode="examples" question={initialQuestion} />
        </div>
        <section className="trace-section">
          <div className="shell trace-shell">
            <BioEvidenceSearch
              sample={sample}
              initialTopicId={topic.id}
              initialSystemId={system.id}
            />
          </div>
        </section>
      </main>
    );
  }

  if (!hasSupabaseConfig()) {
    return (
      <main className="live-page ask-page">
        <div className="shell">
          <AskModeTabs activeMode="live" question={initialQuestion} />
          <section className="auth-panel" style={{ margin: "2rem auto", maxWidth: 720 }}>
            <p className="section-kicker">Live setup needed</p>
            <h1>Connect your own workspace to ask live questions.</h1>
            <p>
              Examples work without an account. Live mode needs Supabase, a
              local retrieval index, Ollama, and the worker running on your
              computer.
            </p>
            <p>
              <Link href="/docs/run-locally">Read the local setup guide</Link>
              {" · "}
              <Link href="/ask?mode=examples">Explore examples</Link>
            </p>
          </section>
        </div>
      </main>
    );
  }

  const { profile, supabase } = await requireAccount("/ask");
  const { data: jobs } = await supabase
    .from("qa_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(8);
  const activeJob = jobs?.[0];
  const [eventsResult, sourcesResult] = activeJob
    ? await Promise.all([
        supabase
          .from("qa_events")
          .select("*")
          .eq("job_id", activeJob.id)
          .order("sequence", { ascending: true }),
        supabase
          .from("qa_sources")
          .select("*")
          .eq("job_id", activeJob.id)
          .order("created_at", { ascending: true }),
      ])
    : [{ data: [] }, { data: [] }];

  return (
    <main className="live-page ask-page">
      <div className="shell">
        <AskModeTabs activeMode="live" question={initialQuestion} />
        <LiveQAWorkspace
          initialEvents={eventsResult.data ?? []}
          initialJobs={jobs ?? []}
          initialQuestion={initialQuestion}
          initialSources={sourcesResult.data ?? []}
          profileName={profile.full_name ?? profile.email}
        />
      </div>
    </main>
  );
}
