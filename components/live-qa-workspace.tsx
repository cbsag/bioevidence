"use client";

import {
  FormEvent,
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Database,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { QAEvent, QAJob, QASource } from "@/lib/supabase/database.types";

type JobBundle = {
  events: QAEvent[];
  job: QAJob;
  sources: QASource[];
};

type WorkerStatus = {
  online: boolean;
  worker: { status: string } | null;
};

type LiveQAWorkspaceProps = {
  initialEvents: QAEvent[];
  initialJobs: QAJob[];
  initialQuestion?: string;
  initialSources: QASource[];
  profileName: string | null;
};

function sortEvents(events: QAEvent[]) {
  return [...events].sort((a, b) => a.sequence - b.sequence);
}

function mergeById<T extends { id: string }>(items: T[], item: T): T[] {
  const next = new Map(items.map((current) => [current.id, current]));
  next.set(item.id, item);
  return [...next.values()];
}

function statusText(job: QAJob | null) {
  if (!job) return "Ready";
  if (job.status === "pending") return "Queued";
  if (job.status === "running") return "Working";
  if (job.status === "completed") return "Answer ready";
  if (job.status === "failed") return "Needs review";
  return "Cancelled";
}

function sourceLabel(source: QASource) {
  if (source.source_type === "clinical_trials") return `Clinical trial ${source.source_id}`;
  if (source.source_type === "europe_pmc" && !source.pmid) {
    return `Europe PMC ${source.source_id}`;
  }
  return `PubMed ${source.pmid ?? source.source_id}`;
}

function sourceProvenance(source: QASource) {
  if (source.source_type === "clinical_trials") return "ClinicalTrials.gov";
  if (source.source_type === "europe_pmc") return "Europe PMC";
  return "PubMed";
}

function citationHref(label: string, sources: QASource[]) {
  const match = label.match(/^\[(PMID|NCT|EPMC):\s*([^\]]+)\]$/i);
  if (!match) return null;
  const prefix = match[1].toUpperCase();
  const sourceId = match[2].split(",")[0].trim();
  const source = sources.find((item) => {
    if (prefix === "PMID") return item.pmid === sourceId;
    return item.source_id === sourceId;
  });
  return source?.url ?? null;
}

function AnswerText({ answer, sources }: { answer: string; sources: QASource[] }) {
  const paragraphs = answer.split(/\n{2,}/).filter(Boolean);
  return (
    <div className="live-answer-copy">
      {paragraphs.map((paragraph, paragraphIndex) => (
        <p key={`${paragraphIndex}-${paragraph.slice(0, 24)}`}>
          {paragraph.split(/(\[(?:PMID|NCT|EPMC):\s*[^\]]+\])/gi).map((part, index) => {
            const href = citationHref(part, sources);
            return href ? (
              <a href={href} key={`${index}-${part}`} rel="noreferrer" target="_blank">
                {part}
              </a>
            ) : (
              <Fragment key={`${index}-${part}`}>{part}</Fragment>
            );
          })}
        </p>
      ))}
    </div>
  );
}

function EventIcon({ event }: { event: QAEvent }) {
  if (event.status === "failed") return <AlertTriangle size={15} aria-hidden="true" />;
  if (event.status === "completed") return <CheckCircle2 size={15} aria-hidden="true" />;
  if (event.status === "queued") return <Clock3 size={15} aria-hidden="true" />;
  if (event.stage.includes("retriev") || event.stage.includes("source")) {
    return <Database size={15} aria-hidden="true" />;
  }
  if (event.stage.includes("generat")) return <Sparkles size={15} aria-hidden="true" />;
  return <Loader2 size={15} aria-hidden="true" />;
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as T | null;
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String(payload.error)
        : "BioEvidence request failed.";
    throw new Error(message);
  }

  if (!payload) throw new Error("BioEvidence returned an empty response.");
  return payload;
}

export function LiveQAWorkspace({
  initialEvents,
  initialJobs,
  initialQuestion = "",
  initialSources,
  profileName,
}: LiveQAWorkspaceProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [question, setQuestion] = useState(initialQuestion);
  const [jobs, setJobs] = useState(initialJobs);
  const [activeJob, setActiveJob] = useState<QAJob | null>(initialJobs[0] ?? null);
  const [events, setEvents] = useState<QAEvent[]>(sortEvents(initialEvents));
  const [sources, setSources] = useState<QASource[]>(initialSources);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus | null>(null);
  const activeJobId = activeJob?.id;

  const loadJob = useCallback(async (jobId: string) => {
    const bundle = await readJson<JobBundle>(await fetch(`/api/live/jobs/${jobId}`));
    setActiveJob(bundle.job);
    setEvents(sortEvents(bundle.events));
    setSources(bundle.sources);
  }, []);

  useEffect(() => {
    if (!activeJobId) return;

    const channel = supabase
      .channel(`bioevidence-live-${activeJobId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          filter: `id=eq.${activeJobId}`,
          schema: "public",
          table: "qa_jobs",
        },
        (payload) => {
          const nextJob = payload.new as QAJob;
          setActiveJob(nextJob);
          setJobs((current) => mergeById(current, nextJob));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          filter: `job_id=eq.${activeJobId}`,
          schema: "public",
          table: "qa_events",
        },
        (payload) => {
          const nextEvent = payload.new as QAEvent;
          setEvents((current) => sortEvents(mergeById(current, nextEvent)));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          filter: `job_id=eq.${activeJobId}`,
          schema: "public",
          table: "qa_sources",
        },
        (payload) => {
          const nextSource = payload.new as QASource;
          setSources((current) => mergeById(current, nextSource));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeJobId, supabase]);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const status = await readJson<WorkerStatus>(await fetch("/api/live/worker/status"));
        if (active) setWorkerStatus(status);
      } catch {
        if (active) setWorkerStatus({ online: false, worker: null });
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 15_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  async function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const { event: queuedEvent, job } = await readJson<{
        event: QAEvent | null;
        job: QAJob;
      }>(
        await fetch("/api/live/jobs", {
          body: JSON.stringify({ question }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }),
      );
      setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]);
      setActiveJob(job);
      setEvents(queuedEvent ? [queuedEvent] : []);
      setSources([]);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not submit BioEvidence question.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const activeEvent = events.at(-1);
  const answerVisible = Boolean(activeJob?.answer_text);
  const answerReady = activeJob?.status === "completed" && answerVisible;
  const userLabel = profileName ? `Signed in as ${profileName}` : "Signed in";

  return (
    <div className="live-workspace">
      <section className="live-hero">
        <div>
          <span>{userLabel}</span>
          <span
            className={`live-worker-state ${workerStatus?.online ? "online" : "offline"}`}
          >
            Mac worker {workerStatus === null ? "checking" : workerStatus.online ? "online" : "offline"}
          </span>
          <h1>Ask BioEvidence.</h1>
          <p>
            Submit a biomedical question and watch the retrieval, evidence
            selection, answer generation, and citation trail update as the
            system processes it.
          </p>
        </div>
      </section>

      <section className="live-console" aria-label="Live BioEvidence question console">
        <form className="live-question-form" onSubmit={submitQuestion}>
          <label htmlFor="live-question">Biomedical question</label>
          <div>
            <Search size={18} aria-hidden="true" />
            <textarea
              id="live-question"
              maxLength={800}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask a clinical or biomedical research question..."
              rows={3}
              value={question}
            />
            <button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Submitting" : "Ask"}
              <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
          {error ? <p className="live-error">{error}</p> : null}
          <p className="live-medical-note">
            Research preview only. Answers are not medical advice or a diagnosis.
          </p>
        </form>

        <div className="live-layout">
          <article className="live-answer-panel">
            <div className="live-job-kicker">
              <span>{statusText(activeJob)}</span>
              {activeEvent ? <em>{activeEvent.title}</em> : <em>Awaiting question</em>}
            </div>

            <div className="live-answer-body">
              <h2>{answerReady ? "Answer" : "Generating answer"}</h2>
              {activeJob?.error_message ? (
                <p className="live-error">{activeJob.error_message}</p>
              ) : null}
              {answerVisible ? (
                <AnswerText answer={activeJob?.answer_text ?? ""} sources={sources} />
              ) : (
                <p className="live-answer-placeholder">
                  {activeJob
                    ? "The answer will appear here after BioEvidence finishes retrieval, citation selection, and generation."
                    : "Ask a question to start a live BioEvidence run."}
                </p>
              )}
            </div>

            <details className="live-sources">
              <summary>Evidence used</summary>
              {sources.length ? (
                <div>
                  {sources.map((source) => (
                    <a
                      href={source.url ?? "#"}
                      key={source.id}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <strong>{sourceLabel(source)}</strong>
                      <em>{sourceProvenance(source)}</em>
                      <span>{source.title ?? "PubMed source"}</span>
                      {source.snippet ? <small>{source.snippet}</small> : null}
                    </a>
                  ))}
                </div>
              ) : (
                <p>Evidence sources will appear as BioEvidence attaches them.</p>
              )}
            </details>
          </article>

          <aside className="live-side-panel">
            <section>
              <span>Process</span>
              <div className="live-event-list">
                {events.length ? (
                  events.map((event) => (
                    <article className={event.status} key={event.id}>
                      <div>
                        <EventIcon event={event} />
                      </div>
                      <section>
                        <strong>{event.title}</strong>
                        {event.detail ? <p>{event.detail}</p> : null}
                      </section>
                    </article>
                  ))
                ) : (
                  <p className="live-muted">The process trail starts after submission.</p>
                )}
              </div>
            </section>

            <section>
              <span>Recent</span>
              <div className="live-job-list">
                {jobs.length ? (
                  jobs.map((job) => (
                    <button
                      className={job.id === activeJob?.id ? "active" : ""}
                      key={job.id}
                      onClick={() => loadJob(job.id)}
                      type="button"
                    >
                      <strong>{job.question}</strong>
                      <small>{statusText(job)}</small>
                    </button>
                  ))
                ) : (
                  <p className="live-muted">No questions yet.</p>
                )}
              </div>
            </section>
          </aside>
        </div>
      </section>
    </div>
  );
}
