import type {
  BioEvidenceAnswer,
  BioEvidenceSample,
  BioEvidenceSystem,
  BioEvidenceTopic,
  CitationSummary,
} from "@/lib/bioevidence-types";

export function findSampleTopic(
  sample: BioEvidenceSample,
  topicId: string,
): BioEvidenceTopic {
  return (
    sample.curated_topics_with_answers.find((topic) => topic.id === topicId) ??
    sample.curated_topics_with_answers[0]
  );
}

export function findSampleSystem(
  sample: BioEvidenceSample,
  systemId: string,
): BioEvidenceSystem {
  return (
    sample.systems.find((system) => system.id === systemId) ??
    sample.systems.find((system) => system.id === sample.demo_defaults.system_id) ??
    sample.systems[0]
  );
}

export function findSampleAnswer(
  topic: BioEvidenceTopic,
  systemId: string,
): BioEvidenceAnswer {
  return (
    topic.answers.find((answer) => answer.system_id === systemId) ??
    topic.answers[0]
  );
}

export function summarizeCitations(
  answer: BioEvidenceAnswer,
): CitationSummary {
  const uniquePmids = [
    ...new Set(answer.sentences.flatMap((sentence) => sentence.citations)),
  ];

  return {
    uniquePmids,
    citationMentions: answer.sentences.reduce(
      (total, sentence) => total + sentence.citations.length,
      0,
    ),
    interpretableSentences: answer.sentences.filter(
      (sentence) => sentence.interpretable !== false,
    ).length,
  };
}

export function pubmedUrl(template: string, pmid: string): string {
  return template.replace("{pmid}", pmid);
}
