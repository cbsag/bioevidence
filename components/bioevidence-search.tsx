"use client";

import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Database,
  FileText,
  Network,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";

import type {
  BioEvidenceAnswer,
  BioEvidenceSample,
  BioEvidenceSentence,
  BioEvidenceSystem,
  BioEvidenceTopic,
} from "@/lib/bioevidence-types";
import {
  getQueryPerspectives,
  type QueryPerspective,
} from "@/lib/bioevidence-process-traces";
import {
  findSampleAnswer,
  findSampleSystem,
  findSampleTopic,
  pubmedUrl,
  summarizeCitations,
} from "@/lib/bioevidence-utils";
import { BioEvidenceLogo } from "@/components/bioevidence-logo";

type BioEvidenceSearchProps = {
  sample: BioEvidenceSample;
  initialTopicId: string;
  initialSystemId: string;
};

type ProcessStage = {
  id: string;
  label: string;
  title: string;
  detail: string;
  icon: typeof FileText;
  facts: string[];
  perspectives?: QueryPerspective[];
};

type EvidenceSource = {
  pmid: string;
  selected: boolean;
  finalRank: number;
  initialRank: number;
  sentenceIndexes: number[];
  snippet: string;
  sourceLabel: string;
};

const answerSentenceDelay = 5200;
const answerTypingDuration = 4700;

function systemMethod(system: BioEvidenceSystem): string {
  if (system.collection === "submitted") return "Official TREC configuration";

  const family = system.pipeline === "dense" ? "Dense MedCPT" : "Sparse BM25";
  return `${family} · ${system.context_label ?? "context"} · ${
    system.extension_label ?? "extension"
  }`;
}

function pathTitle(system: BioEvidenceSystem): string {
  if (system.pipeline === "dense") return "Dense path with MedCPT";
  if (system.pipeline === "sparse") return "Sparse path with BM25";
  return "Official submitted path";
}

function pathDetail(system: BioEvidenceSystem): string {
  if (system.pipeline === "dense") {
    return "The dense configuration uses the common BM25 pool, then applies dense biomedical retrieval signals before evidence selection.";
  }

  if (system.pipeline === "sparse") {
    return "The sparse configuration keeps the lexical BM25 path and uses reranking to prioritize PubMed documents that support the answer.";
  }

  return "The official submitted system follows the archived TREC configuration for this answer.";
}

function buildProcessStages(
  topic: BioEvidenceTopic,
  system: BioEvidenceSystem,
  answer: BioEvidenceAnswer,
  selectedSources: EvidenceSource[],
  evidenceSources: EvidenceSource[],
  perspectives: QueryPerspective[],
): ProcessStage[] {
  const summary = summarizeCitations(answer);

  return [
    {
      id: "query",
      label: "Reading question",
      title: "Understand the biomedical question",
      detail:
        "BioEvidence starts from the selected patient-style question and its TREC topic context.",
      icon: FileText,
      facts: [`Topic ${topic.id}`, topic.label ?? "Curated question"],
    },
    {
      id: "reformulate",
      label: "Reformulating question",
      title: "Create three search perspectives",
      detail:
        "The question is rewritten into complementary search angles before PubMed evidence is collected.",
      icon: Sparkles,
      facts: ["Meaning", "Patient concern", "Outcome"],
      perspectives,
    },
    {
      id: "lexical",
      label: "Common retrieval",
      title: "Search PubMed with four query branches",
      detail:
        "The original question and three reformulations are sent through Pyserini BM25 to collect documents with strong lexical overlap.",
      icon: Search,
      facts: ["Original + 3 reformulations", "Pyserini BM25", "PubMed documents"],
    },
    {
      id: "path",
      label: "Choosing path",
      title: pathTitle(system),
      detail: pathDetail(system),
      icon: Database,
      facts: [systemMethod(system), "Sparse or dense configuration"],
    },
    {
      id: "retrieve",
      label: "Searching evidence",
      title: "Build the evidence pool",
      detail:
        "BioEvidence keeps PubMed-linked candidates from the chosen path and prepares them for reranking.",
      icon: Database,
      facts: [
        `${system.unique_pmids.toLocaleString()} PMIDs available for this system`,
        `${evidenceSources.length} visible evidence candidates`,
      ],
    },
    {
      id: "rerank",
      label: "Reranking sources",
      title: "Move answer-supporting evidence upward",
      detail:
        "Candidate PMIDs are prioritized so the strongest evidence is considered before the answer is written.",
      icon: Sparkles,
      facts: [
        system.badges?.[0] ?? "Evidence ranking",
        `${evidenceSources.length} candidates in view`,
      ],
    },
    {
      id: "select",
      label: "Selecting citations",
      title: "Keep sources that support answer sentences",
      detail:
        "BioEvidence narrows the candidate set to sources that can be cited against final answer sentences.",
      icon: Database,
      facts: [
        `${selectedSources.length} cited sources retained`,
        `${summary.citationMentions} citation markers`,
      ],
    },
    {
      id: "generate",
      label: "Generating answer",
      title: "Write one cited sentence at a time",
      detail:
        "The answer is composed sentence by sentence, keeping citation markers close to the sentence they support.",
      icon: Network,
      facts: [
        `${answer.sentences.length} answer sentences`,
        `${summary.uniquePmids.length} linked PubMed sources`,
      ],
    },
    {
      id: "verify",
      label: "Checking support",
      title: "Keep the citation trail visible",
      detail:
        "The final response keeps the source PMIDs available without forcing the reader through a large evidence table.",
      icon: ShieldCheck,
      facts: [
        `${summary.uniquePmids.length} cited PMIDs`,
        "Visible evidence trail",
      ],
    },
  ];
}

function topicOptionLabel(topic: BioEvidenceTopic): string {
  return `${topic.id} · ${topic.label ?? topic.question}`;
}

function claimRefs(indexes: number[]): string {
  if (!indexes.length) return "Background source";

  return indexes.length === 1
    ? `Supports sentence ${indexes[0]}`
    : `Supports sentences ${indexes.join(", ")}`;
}

function supportingSentenceIndexes(
  sentences: BioEvidenceSentence[],
  pmid: string,
): number[] {
  return sentences
    .map((sentence, index) =>
      sentence.citations.includes(pmid) ? index + 1 : null,
    )
    .filter((index): index is number => index !== null);
}

function snippetForPmid(
  sentences: BioEvidenceSentence[],
  pmid: string,
): string {
  const sentence =
    sentences.find((candidate) => candidate.citations.includes(pmid)) ??
    sentences[0];
  return sentence.text.length > 142
    ? `${sentence.text.slice(0, 142).trim()}...`
    : sentence.text;
}

function rankSeed(pmid: string, index: number, total: number): number {
  if (total <= 1) return 1;

  const numeric = Number.parseInt(pmid.slice(-4), 10);
  return ((Number.isNaN(numeric) ? index * 7 : numeric + index * 3) % total) + 1;
}

function buildEvidenceSources(
  answer: BioEvidenceAnswer,
  comparisonAnswer: BioEvidenceAnswer,
): EvidenceSource[] {
  const selectedPmids = summarizeCitations(answer).uniquePmids;
  const comparisonPmids = summarizeCitations(comparisonAnswer).uniquePmids;
  const backgroundPmids = comparisonPmids
    .filter((pmid) => !selectedPmids.includes(pmid))
    .slice(0, 5);
  const combined = [
    ...selectedPmids.map((pmid, index) => ({
      pmid,
      selected: true,
      finalRank: index + 1,
      sentenceIndexes: supportingSentenceIndexes(answer.sentences, pmid),
      snippet: snippetForPmid(answer.sentences, pmid),
      sourceLabel: "Cited source",
    })),
    ...backgroundPmids.map((pmid, index) => ({
      pmid,
      selected: false,
      finalRank: selectedPmids.length + index + 1,
      sentenceIndexes: supportingSentenceIndexes(
        comparisonAnswer.sentences,
        pmid,
      ),
      snippet: snippetForPmid(comparisonAnswer.sentences, pmid),
      sourceLabel: "Background candidate",
    })),
  ];

  return combined.map((source, index) => ({
    ...source,
    initialRank: rankSeed(source.pmid, index, combined.length),
  }));
}

function activeStageIndex(
  step: number,
  totalSteps: number,
  sourceRevealStartStep: number,
): number {
  if (step <= 0) return 0;
  if (step <= 3) return 1;
  if (step === 4) return 2;
  if (step === 5) return 3;
  if (step === 6) return 4;
  if (step === 7) return 5;
  if (step === 8) return 6;
  if (step >= sourceRevealStartStep) return 8;
  if (step < totalSteps - 1) return 7;
  return 8;
}

function processDetail(
  step: number,
  totalSteps: number,
  answerStartStep: number,
  sourceRevealStartStep: number,
  system: BioEvidenceSystem,
  selectedSources: EvidenceSource[],
  perspectives: QueryPerspective[],
  citationCount: number,
): string {
  if (step >= totalSteps - 1) {
    return `answer complete · ${citationCount} linked PubMed sources`;
  }

  if (step >= sourceRevealStartStep) {
    return "linking the PubMed sources cited in the answer";
  }

  if (step >= answerStartStep) {
    return `writing the answer slowly with citation markers`;
  }

  if (step === 8) {
    return "organizing selected evidence into answer sentences";
  }

  if (step === 7) {
    return `${selectedSources.length} sources retained for the answer`;
  }

  if (step === 6) {
    return "building the PubMed-linked evidence pool from retrieved documents";
  }

  if (step === 5) {
    return pathDetail(system);
  }

  if (step === 4) {
    return "original question + three reformulations through Pyserini BM25";
  }

  if (step >= 1) {
    const perspective = perspectives[step - 1];
    return perspective
      ? `${perspective.label}: ${perspective.query}`
      : "rewriting the question for retrieval";
  }

  return "preparing retrieval-friendly context";
}

function statusLabel(
  step: number,
  totalSteps: number,
  answerStartStep: number,
  sourceRevealStartStep: number,
  system: BioEvidenceSystem,
): string {
  if (step >= totalSteps - 1) return "Answer";
  if (step >= sourceRevealStartStep) return "Showing evidence used";
  if (step >= answerStartStep) return "Generating answer";
  if (step === 8) return "Preparing cited answer";
  if (step === 7) return "Selecting cited evidence";
  if (step === 6) return "Searching evidence";
  if (step === 5) return pathTitle(system);
  if (step === 4) return "Common BM25 retrieval";
  if (step >= 1) return "Reformulating question";
  return "Reading question";
}

function citationLabel(sources: EvidenceSource[], pmid: string): string {
  const sourceIndex = sources.findIndex((source) => source.pmid === pmid);
  return sourceIndex >= 0 ? String(sourceIndex + 1) : "?";
}

function citationText(sentence: BioEvidenceSentence, sources: EvidenceSource[]): string {
  return sentence.citations
    .map((pmid) => `[${citationLabel(sources, pmid)}]`)
    .join(" ");
}

function typedSentenceText(
  sentence: BioEvidenceSentence,
  sources: EvidenceSource[],
): string {
  const citations = citationText(sentence, sources);
  return citations ? `${sentence.text} ${citations}` : sentence.text;
}

export function BioEvidenceSearch({
  sample,
  initialTopicId,
  initialSystemId,
}: BioEvidenceSearchProps) {
  const [topicId, setTopicId] = useState(initialTopicId);
  const [systemId, setSystemId] = useState(initialSystemId);
  const [searchStep, setSearchStep] = useState(0);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [processOpen, setProcessOpen] = useState(false);
  const [typedProgress, setTypedProgress] = useState({
    count: 0,
    key: "",
  });

  const topic = findSampleTopic(sample, topicId);
  const system = findSampleSystem(sample, systemId);
  const answer = findSampleAnswer(topic, system.id);
  const citationSummary = summarizeCitations(answer);
  const comparisonSystem = findSampleSystem(
    sample,
    sample.demo_defaults.comparison_system_ids[0] ?? "A",
  );
  const comparisonAnswer = findSampleAnswer(topic, comparisonSystem.id);
  const evidenceSources = buildEvidenceSources(answer, comparisonAnswer);
  const selectedSources = evidenceSources.filter((source) => source.selected);
  const compactSources = selectedSources;
  const answerStartStep = 9;
  const answerCompleteStep = answerStartStep + answer.sentences.length;
  const sourceRevealStartStep = answerCompleteStep;
  const totalSteps = sourceRevealStartStep + compactSources.length + 1;
  const visibleSentences =
    searchStep >= answerStartStep
      ? Math.min(
          answer.sentences.length,
          Math.max(1, searchStep - answerStartStep + 1),
        )
      : 0;
  const answerComplete = searchStep >= answerCompleteStep;
  const sourceRevealStarted = searchStep >= sourceRevealStartStep;
  const visibleSourceCount = sourceRevealStarted
    ? Math.min(
        compactSources.length,
        Math.max(1, searchStep - sourceRevealStartStep + 1),
      )
    : 0;
  const queryPerspectives = getQueryPerspectives(topic.id, topic.question);
  const activePmidFallback = citationSummary.uniquePmids[0] ?? "";
  const [activePmid, setActivePmid] = useState(activePmidFallback);
  const activeSource =
    evidenceSources.find((source) => source.pmid === activePmid) ??
    selectedSources[0];
  const answerStarted = searchStep >= answerStartStep;
  const finished = searchStep >= totalSteps - 1;
  const typingSentenceIndex =
    answerStarted && !answerComplete ? visibleSentences - 1 : -1;
  const typingSentence =
    typingSentenceIndex >= 0 ? answer.sentences[typingSentenceIndex] : null;
  const fullTypingText = typingSentence
    ? typedSentenceText(typingSentence, selectedSources)
    : "";
  const typingProgressKey =
    typingSentenceIndex >= 0
      ? `${topic.id}:${system.id}:${typingSentenceIndex}:${searchStep}`
      : "";
  const typedCharCount =
    typedProgress.key === typingProgressKey ? typedProgress.count : 0;
  const processStages = buildProcessStages(
    topic,
    system,
    answer,
    selectedSources,
    evidenceSources,
    queryPerspectives,
  );
  const currentStageIndex = activeStageIndex(
    searchStep,
    totalSteps,
    sourceRevealStartStep,
  );
  const visibleProcessStages = processStages.slice(0, currentStageIndex + 1);
  const submittedSystems = sample.systems.filter(
    (candidate) => candidate.collection === "submitted",
  );
  const thesisSystems = sample.systems.filter(
    (candidate) => candidate.collection !== "submitted",
  );

  function resetSearch(nextTopicId: string, nextSystemId: string) {
    const nextTopic = findSampleTopic(sample, nextTopicId);
    setSearchStep(0);
    setTypedProgress({ count: 0, key: "" });
    setSearching(false);
    setHasSearched(false);
    setProcessOpen(false);
    setActivePmid(
      summarizeCitations(findSampleAnswer(nextTopic, nextSystemId))
        .uniquePmids[0] ?? "",
    );
  }

  function selectTopic(nextTopicId: string) {
    setTopicId(nextTopicId);
    resetSearch(nextTopicId, system.id);
  }

  function selectSystem(nextSystemId: string) {
    setSystemId(nextSystemId);
    resetSearch(topic.id, nextSystemId);
  }

  function runSearch() {
    setHasSearched(true);
    setSearchStep(0);
    setTypedProgress({ count: 0, key: "" });
    setSearching(true);
    setActivePmid(activePmidFallback);
  }

  useEffect(() => {
    if (!searching || typingSentenceIndex < 0 || !fullTypingText) {
      return;
    }

    const startedAt = window.performance.now();
    const timer = window.setInterval(() => {
      const elapsed = window.performance.now() - startedAt;
      const nextCount = Math.min(
        fullTypingText.length,
        Math.max(
          1,
          Math.ceil((elapsed / answerTypingDuration) * fullTypingText.length),
        ),
      );

      setTypedProgress({
        count: nextCount,
        key: typingProgressKey,
      });

      if (nextCount >= fullTypingText.length) {
        window.clearInterval(timer);
      }
    }, 42);

    return () => window.clearInterval(timer);
  }, [fullTypingText, searching, typingProgressKey, typingSentenceIndex]);

  useEffect(() => {
    if (!searching) return;

    const answerDelay =
      searchStep >= answerStartStep && searchStep < sourceRevealStartStep;
    const sourceDelay =
      searchStep >= sourceRevealStartStep && searchStep < totalSteps - 1;
    const timer = window.setTimeout(
      () => {
        setSearchStep((current) => {
          const next = Math.min(current + 1, totalSteps - 1);
          if (next >= totalSteps - 1) {
            setSearching(false);
          }
          return next;
        });
      },
      answerDelay ? answerSentenceDelay : sourceDelay ? 1250 : 1850,
    );

    return () => window.clearTimeout(timer);
  }, [answerStartStep, searching, searchStep, sourceRevealStartStep, totalSteps]);

  return (
    <section
      className={["trace-product", hasSearched ? "has-run" : "idle"].join(" ")}
      aria-label="BioEvidence biomedical answer search"
    >
      <div className="trace-search-console">
        <div className="trace-brandline">
          <div className="trace-wordmark">
            <BioEvidenceLogo
              className="bio-logo-mark trace-logo-wordmark"
              variant="wordmark"
            />
          </div>
          <p>Ask a biomedical question and see how the answer stays tied to evidence.</p>
        </div>

        <div
          className={["trace-query-bar", searching ? "running" : ""].join(" ")}
        >
          <span className="query-logo-wrap" aria-hidden="true">
            <BioEvidenceLogo
              className="bio-logo-mark query-logo-mark"
              variant="search"
            />
          </span>
          <input
            aria-label="Selected biomedical question"
            readOnly
            value={topic.question}
          />
          <button
            type="button"
            onClick={runSearch}
            disabled={searching}
            aria-label={searching ? "Searching example" : "Run example"}
          >
            <Search className="trace-mobile-search-icon" size={18} aria-hidden="true" />
            <span>{searching ? "Searching" : "Search"}</span>
          </button>
        </div>
        <p className="trace-medical-note">
          Archived research example. Not medical advice or a diagnosis.
        </p>

        {hasSearched ? (
          <div
            className={[
              "trace-process-rail",
              processOpen ? "open" : "",
              finished ? "finished" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="trace-process-line">
              <div>
                <span
                  className={[
                    "trace-process-pulse",
                    processStages[currentStageIndex]?.id,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-hidden="true"
                />
                <strong>
                  {statusLabel(
                    searchStep,
                    totalSteps,
                    answerStartStep,
                    sourceRevealStartStep,
                    system,
                  )}
                </strong>
                <small>
                  {processDetail(
                    searchStep,
                    totalSteps,
                    answerStartStep,
                    sourceRevealStartStep,
                    system,
                    selectedSources,
                    queryPerspectives,
                    citationSummary.uniquePmids.length,
                  )}
                </small>
              </div>
              <button
                type="button"
                className="trace-process-toggle"
                aria-label={
                  processOpen
                    ? "Collapse answer process"
                    : "Expand answer process"
                }
                aria-expanded={processOpen}
                onClick={() => setProcessOpen((open) => !open)}
              >
                <ChevronDown size={17} aria-hidden="true" />
              </button>
            </div>

            {processOpen ? (
              <div className="trace-process-panel">
                {visibleProcessStages.map((stage, index) => {
                  const StageIcon = stage.icon;
                  const isActive = index === currentStageIndex && !finished;
                  const isComplete = index < currentStageIndex || finished;
                  const visiblePerspectives =
                    stage.id === "reformulate" && stage.perspectives
                      ? stage.perspectives.slice(
                          0,
                          Math.min(3, Math.max(1, searchStep)),
                        )
                      : stage.perspectives;

                  return (
                    <section
                      className={[
                        "trace-process-card",
                        stage.id,
                        isActive ? "active" : "",
                        isComplete ? "complete" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      key={stage.id}
                    >
                      <span>
                        {isComplete ? (
                          <CheckCircle2 size={15} aria-hidden="true" />
                        ) : (
                          <StageIcon size={15} aria-hidden="true" />
                        )}
                      </span>
                      <div>
                        <small>{stage.label}</small>
                        <strong>{stage.title}</strong>
                        <p>{stage.detail}</p>
                        {visiblePerspectives ? (
                          <ol className="trace-perspective-list">
                            {visiblePerspectives.map((perspective) => (
                              <li key={perspective.label}>
                                <span>{perspective.label}</span>
                                <p>{perspective.query}</p>
                              </li>
                            ))}
                          </ol>
                        ) : null}
                        <div>
                          {stage.facts.map((fact) => (
                            <em key={fact}>{fact}</em>
                          ))}
                        </div>
                      </div>
                    </section>
                  );
                })}

                {currentStageIndex >= 3 ? (
                  <div className="trace-process-sources">
                    <strong>Cited evidence emerging</strong>
                    <div>
                      {compactSources.slice(0, 4).map((source, index) => (
                        <button
                          type="button"
                          className={source.pmid === activePmid ? "active" : ""}
                          onClick={() => setActivePmid(source.pmid)}
                          key={`process-${source.pmid}`}
                        >
                          {index + 1}. PMID {source.pmid}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <details className="bio-demo-settings">
          <summary>
            <span>Change example</span>
            <ChevronDown size={15} aria-hidden="true" />
          </summary>
          <div className="trace-controls">
            <label>
              <span>Example question</span>
              <select
                value={topic.id}
                onChange={(event) => selectTopic(event.target.value)}
              >
                {sample.curated_topics_with_answers.map((candidate) => (
                  <option value={candidate.id} key={candidate.id}>
                    {topicOptionLabel(candidate)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Evidence setup</span>
              <select
                value={system.id}
                onChange={(event) => selectSystem(event.target.value)}
              >
                <optgroup label="Thesis experiments">
                  {thesisSystems.map((candidate) => (
                    <option value={candidate.id} key={candidate.id}>
                      {candidate.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Official TREC submissions">
                  {submittedSystems.map((candidate) => (
                    <option value={candidate.id} key={candidate.id}>
                      {candidate.label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
          </div>
        </details>
      </div>

      {answerStarted ? (
        <div className="trace-live-workspace">
          <section className="bio-answer-surface" aria-live="polite">
            <article className="bio-answer-card">
              <div className="bio-answer-heading">
                <span>
                  {answerComplete ? "Answer" : "Generating answer"}
                </span>
              </div>

              <div className="product-answer-copy bio-answer-copy">
                {answer.sentences
                  .slice(0, visibleSentences)
                  .map((sentence, index) => {
                    const typing = index === typingSentenceIndex;
                    const typingText = typing
                      ? typedSentenceText(sentence, selectedSources)
                      : "";
                    const visibleTypingText = typing
                      ? typingText.slice(
                          0,
                          Math.min(typedCharCount, typingText.length),
                        )
                      : "";
                    return (
                      <p
                        className={[
                          sentence.citations.includes(activePmid)
                            ? "active"
                            : "",
                          typing ? "typing" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        key={`${system.id}-${index}`}
                      >
                        {typing ? (
                          <>
                            <span className="typed-copy typing-stream">
                              {visibleTypingText}
                            </span>
                            <span className="typing-dot" aria-hidden="true" />
                          </>
                        ) : (
                          <>
                            <span className="typed-copy">{sentence.text}</span>{" "}
                            <span className="claim-citations">
                              {sentence.citations.map((pmid) => (
                                <button
                                  type="button"
                                  className={
                                    activePmid === pmid ? "active" : ""
                                  }
                                  onClick={() => setActivePmid(pmid)}
                                  key={`${system.id}-${index}-${pmid}`}
                                >
                                  [{citationLabel(selectedSources, pmid)}]
                                </button>
                              ))}
                            </span>
                          </>
                        )}
                      </p>
                    );
                  })}

              </div>

              {sourceRevealStarted ? (
                <details className="bio-source-dock">
                  <summary>
                    <div>
                      <span className="section-kicker">Evidence used</span>
                      <strong>
                        {citationSummary.uniquePmids.length} PubMed sources linked to this
                        answer
                      </strong>
                    </div>
                    <small>{systemMethod(system)}</small>
                    <ChevronDown size={16} aria-hidden="true" />
                  </summary>

                  <div className="source-list">
                    {compactSources.slice(0, visibleSourceCount).map((source, index) => (
                      <button
                        type="button"
                        className={[
                          source.pmid === activePmid ? "active" : "",
                          index === visibleSourceCount - 1 && !finished
                            ? "typing"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => setActivePmid(source.pmid)}
                        key={source.pmid}
                      >
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <strong>PMID {source.pmid}</strong>
                        <small>{claimRefs(source.sentenceIndexes)}</small>
                      </button>
                    ))}
                  </div>

                  {activeSource ? (
                    <div className="source-inspector">
                      <strong>PMID {activeSource.pmid}</strong>
                      <p>{activeSource.snippet}</p>
                      <a
                        href={pubmedUrl(
                          sample.site.pubmed_url_template,
                          activeSource.pmid,
                        )}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open PubMed
                        <ArrowRight size={13} aria-hidden="true" />
                      </a>
                    </div>
                  ) : null}

                </details>
              ) : null}
            </article>
          </section>
        </div>
      ) : null}
    </section>
  );
}
