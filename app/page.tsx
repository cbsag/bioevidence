import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  Search,
} from "lucide-react";

import { BioEvidenceLogo } from "@/components/bioevidence-logo";
import { loadBioEvidenceSample } from "@/lib/bioevidence-sample";
import { officialResults } from "@/lib/results";
import { hasSupabaseConfig } from "@/lib/supabase/config";

const productSteps = [
  {
    title: "Question understanding",
    copy: "The system rewrites the biomedical question into complementary retrieval perspectives.",
  },
  {
    title: "Evidence retrieval",
    copy: "PubMed candidates are collected through lexical BM25 and sparse or dense retrieval paths.",
  },
  {
    title: "Citation control",
    copy: "Answer sentences stay connected to the PubMed sources used to support them.",
  },
  {
    title: "Inspectable output",
    copy: "The answer, process, and evidence trail stay visible for review instead of hiding behind a chat bubble.",
  },
];

const workspaceSurfaces = [
  "Recent live question history",
  "Source-by-source evidence inspection",
  "Public finished example runs",
  "Account and access controls",
];

export default function ProductHomePage() {
  const liveConfigured = hasSupabaseConfig();
  const sample = loadBioEvidenceSample();
  const defaultTopic =
    sample.curated_topics_with_answers.find(
      (topic) => topic.id === sample.demo_defaults.topic_id,
    ) ?? sample.curated_topics_with_answers[0];
  const askHref = liveConfigured ? "/ask" : "/ask?mode=examples";
  const exampleHref = `/ask?${new URLSearchParams({
    mode: "examples",
    topic: defaultTopic.id,
  }).toString()}`;
  const denseWide = officialResults.find((result) => result.id === "D")!;
  const sparseWide = officialResults.find((result) => result.id === "E")!;

  return (
    <main className="product-site-home">
      <section className="product-landing">
        <div className="shell product-landing-inner">
          <div className="product-beta-pill">Local-first biomedical evidence</div>
          <BioEvidenceLogo
            className="bio-logo-mark product-landing-logo"
            variant="wordmark"
          />
          <h1>BioEvidence AI</h1>
          <p className="product-landing-copy">
            Ask a biomedical question, follow the retrieval and reranking
            steps, then inspect an answer linked to its supporting sources.
          </p>

          <div className="product-landing-actions">
            <Link className="product-primary-action" href={askHref}>
              <Search size={16} aria-hidden="true" />
              {liveConfigured ? "Ask live" : "Explore examples"}
            </Link>
            <Link
              className="product-secondary-action"
              href={liveConfigured ? "/ask?mode=examples" : "/docs"}
            >
              <BookOpen size={16} aria-hidden="true" />
              {liveConfigured ? "Explore examples" : "Read docs"}
            </Link>
          </div>

          <Link className="product-search-strip" href={exampleHref}>
            <span aria-hidden="true">
              <Search size={17} />
            </span>
            <div>
              <small>Example question</small>
              <strong>{defaultTopic.question}</strong>
            </div>
            <em>
              Explore this question
              <ArrowRight size={14} aria-hidden="true" />
            </em>
          </Link>

          <div className="product-signal-row" aria-label="Product status">
            <span>{sample.stats.saved_answers} finished example answers</span>
            <span>{sample.stats.unique_pmids.toLocaleString()} linked PubMed IDs</span>
            <span>Local retrieval + inspectable trace</span>
          </div>

          <Link className="product-scroll-cue" href="#how-it-works" aria-label="Scroll to workflow">
            <ChevronDown size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="product-system-section" id="how-it-works">
        <div className="shell">
          <div className="product-section-heading">
            <span>How it works</span>
            <h2>Built for answers that can be inspected.</h2>
            <p>
              BioEvidence separates question planning, PubMed retrieval,
              reranking, evidence selection, generation, and citation linking
              so each step can be reviewed.
            </p>
          </div>

          <div className="product-step-grid">
            {productSteps.map((step, index) => (
              <article key={step.title}>
                <span className="product-step-number">0{index + 1}</span>
                <strong>{step.title}</strong>
                <p>{step.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="product-beta-section">
        <div className="shell product-beta-grid">
          <div>
            <span>Workspace</span>
            <h2>A focused place to review biomedical answers.</h2>
            <p>
              Live runs show their current step, recent questions, and source
              trail. Finished example runs are open to explore without signing
              in.
            </p>
            <div className="product-landing-actions compact">
              <Link
                className="product-primary-action"
                href={liveConfigured ? "/request-access" : "/docs/run-locally"}
              >
                {liveConfigured ? "Request access" : "Read setup docs"}
              </Link>
              <Link
                className="product-secondary-action"
                href={liveConfigured ? "/account" : "/ask?mode=examples"}
              >
                {liveConfigured ? "Open account" : "Explore examples"}
              </Link>
            </div>
          </div>
          <ul>
            {workspaceSurfaces.map((surface) => (
              <li key={surface}>
                <span>{surface}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="product-proof-section">
        <div className="shell">
          <div className="product-section-heading">
            <span>Evaluation signal</span>
            <h2>Public evaluation context stays available when people want depth.</h2>
          </div>
          <div className="product-proof-grid">
            <article>
              <strong>{denseWide.answerPrecision.toFixed(2)}</strong>
              <span>Best answer precision</span>
              <small>Official system D</small>
            </article>
            <article>
              <strong>{sparseWide.citationCoverage.toFixed(2)}</strong>
              <span>Best citation coverage</span>
              <small>Official system E</small>
            </article>
            <article>
              <strong>{sample.stats.selectable_systems}</strong>
              <span>Answer systems</span>
              <small>Submitted and thesis configurations</small>
            </article>
          </div>
          <Link className="product-inline-link" href="/results">
            Review shared-task results
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="product-docs-cta">
        <div className="shell">
          <div>
            <span>Documentation</span>
            <h2>Understand the workflow, citations, and evaluation context.</h2>
          </div>
          <Link href="/docs">
            Open docs
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  );
}
