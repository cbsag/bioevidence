import type { Metadata } from "next";

import { BioEvidenceSearch } from "@/components/bioevidence-search";
import { loadBioEvidenceSample } from "@/lib/bioevidence-sample";
import { findSampleSystem, findSampleTopic } from "@/lib/bioevidence-utils";

export const metadata: Metadata = {
  title: "BioEvidence Search",
  description:
    "Search biomedical questions with BioEvidence and inspect citation-linked answers.",
};

type TracePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TracePage({ searchParams }: TracePageProps) {
  const sample = loadBioEvidenceSample();
  const params = (await searchParams) ?? {};
  const requestedTopicId =
    firstValue(params.topic) ?? sample.demo_defaults.topic_id;
  const requestedSystemId =
    firstValue(params.system) ?? sample.demo_defaults.system_id;
  const topic = findSampleTopic(sample, requestedTopicId);
  const system = findSampleSystem(sample, requestedSystemId);

  return (
    <main className="trace-page trace-run-page">
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
