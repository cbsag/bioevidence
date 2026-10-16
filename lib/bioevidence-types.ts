export type BioEvidenceMetricSet = {
  recall: number;
  correctness: number;
  precision: number;
  completeness: number;
  citation_support_rate: number;
  citation_contradiction_rate: number;
};

export type BioEvidenceSystem = {
  id: string;
  run_id: string;
  collection: "submitted" | "new_experiment";
  label: string;
  family?: "D" | "S";
  pipeline?: "dense" | "sparse";
  context?: string;
  extension?: string;
  context_label?: string;
  extension_label?: string;
  description?: string;
  badges?: string[];
  answers: number;
  sentences: number;
  citation_mentions: number;
  unique_pmids: number;
  bioace_181_182?: BioEvidenceMetricSet;
};

export type BioEvidenceSentence = {
  text: string;
  citations: string[];
  interpretable?: boolean;
};

export type BioEvidenceAnswer = {
  system_id: string;
  sentences: BioEvidenceSentence[];
};

export type BioEvidenceTopic = {
  id: string;
  label?: string;
  question: string;
  narrative: string;
  answer_count: number;
  answers: BioEvidenceAnswer[];
};

export type BioEvidencePreset = {
  id: string;
  label: string;
  systems: string[];
};

export type BioEvidenceSample = {
  schema_version: string;
  purpose: string;
  site: {
    product_name: string;
    headline: string;
    subheadline: string;
    primary_cta: { label: string; href: string };
    secondary_cta: { label: string; href: string };
    pipeline: string[];
    pubmed_url_template: string;
    replay_disclosure: string;
    medical_disclaimer: string;
  };
  stats: {
    topics: number;
    selectable_systems: number;
    submitted_systems: number;
    new_experimental_systems: number;
    saved_answers: number;
    submitted_answers: number;
    new_experimental_answers: number;
    sentences: number;
    citation_mentions: number;
    unique_pmids: number;
    curated_topics: number;
    curated_answers_in_this_file: number;
    note: string;
  };
  experiment_design: {
    formula: string;
    families: Array<{ id: string; label: string }>;
    contexts: Array<{ id: string; label: string }>;
    extensions: Array<{ id: string; label: string }>;
  };
  demo_defaults: {
    topic_id: string;
    system_id: string;
    comparison_system_ids: string[];
  };
  demo_presets: BioEvidencePreset[];
  metric_scope_warning: string;
  systems: BioEvidenceSystem[];
  curated_topics_with_answers: BioEvidenceTopic[];
  frontend_usage: Record<string, string>;
  sources: string[];
};

export type CitationSummary = {
  uniquePmids: string[];
  citationMentions: number;
  interpretableSentences: number;
};
