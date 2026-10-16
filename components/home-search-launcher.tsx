"use client";

import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { useMemo, useState } from "react";

import type {
  BioEvidenceSystem,
  BioEvidenceTopic,
} from "@/lib/bioevidence-types";

type HomeSearchLauncherProps = {
  topics: BioEvidenceTopic[];
  systems: BioEvidenceSystem[];
  defaultTopicId: string;
  defaultSystemId: string;
};

function traceHref(topicId: string, systemId: string): string {
  const params = new URLSearchParams({
    mode: "examples",
    system: systemId,
    topic: topicId,
  });
  return `/ask?${params.toString()}`;
}

function topicOptionLabel(topic: BioEvidenceTopic): string {
  return `${topic.id} · ${topic.label ?? topic.question}`;
}

export function HomeSearchLauncher({
  topics,
  systems,
  defaultTopicId,
  defaultSystemId,
}: HomeSearchLauncherProps) {
  const [topicId, setTopicId] = useState(defaultTopicId);
  const [systemId, setSystemId] = useState(defaultSystemId);
  const selectedTopic =
    topics.find((topic) => topic.id === topicId) ?? topics[0];
  const selectedSystem =
    systems.find((system) => system.id === systemId) ?? systems[0];
  const href = useMemo(() => traceHref(topicId, systemId), [systemId, topicId]);

  return (
    <div className="home-search-launcher" aria-label="Search with BioEvidence">
      <div className="launcher-heading">
        <span>Ask BioEvidence</span>
        <strong>Choose a biomedical question</strong>
      </div>

      <label>
        <span>Question</span>
        <select
          value={selectedTopic.id}
          onChange={(event) => setTopicId(event.target.value)}
        >
          {topics.map((topic) => (
            <option value={topic.id} key={topic.id}>
              {topicOptionLabel(topic)}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>System</span>
        <select
          value={selectedSystem.id}
          onChange={(event) => setSystemId(event.target.value)}
        >
          {systems.map((system) => (
            <option value={system.id} key={system.id}>
              {system.label}
            </option>
          ))}
        </select>
      </label>

      <div className="launcher-preview">
        <span>Selected question</span>
        <p>{selectedTopic.question}</p>
        <small>{selectedSystem.label}</small>
      </div>

      <Link className="launcher-run" href={href}>
        <Search size={15} aria-hidden="true" />
        Search evidence
        <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </div>
  );
}
