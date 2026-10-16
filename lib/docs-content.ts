export type BioEvidenceDoc = {
  slug: string;
  title: string;
  description: string;
  sections: Array<{
    heading: string;
    body: string[];
  }>;
};

export const docsPages: BioEvidenceDoc[] = [
  {
    slug: "introduction",
    title: "What is BioEvidence AI?",
    description:
      "The evidence-grounded biomedical QA product that keeps PubMed citations and process visibility attached to every answer.",
    sections: [
      {
        heading: "What it is",
        body: [
          "BioEvidence AI is a biomedical question-answering product designed for answers that can be inspected. It combines retrieval, evidence selection, answer generation, and citation control into one reviewable workflow.",
          "The product brings together an answer workspace, account access, citation review, and transparent process traces for evidence-grounded biomedical QA.",
        ],
      },
      {
        heading: "Why it exists",
        body: [
          "Biomedical answers are hard to trust when the source trail is hidden. BioEvidence keeps the question, retrieval process, answer text, and PubMed evidence connected so a reviewer can see why an answer was produced.",
        ],
      },
    ],
  },
  {
    slug: "how-it-works",
    title: "How it works",
    description:
      "BioEvidence turns a biomedical question into reformulated searches, ranked PubMed evidence, and cited answer sentences.",
    sections: [
      {
        heading: "Pipeline",
        body: [
          "The workflow moves through question reformulation, common BM25 retrieval, sparse or dense path selection, reranking, citation selection, and answer generation.",
          "Each step is shown as a process trail so the reader can inspect what the system is doing without reading a full research report first.",
        ],
      },
      {
        heading: "Retrieval paths",
        body: [
          "BioEvidence supports sparse BM25-style retrieval and dense biomedical retrieval experiments. The preview lets users switch between saved configurations to compare how retrieval choices affect evidence and answers.",
        ],
      },
    ],
  },
  {
    slug: "citations",
    title: "Citation grounding",
    description:
      "How BioEvidence keeps answer sentences connected to PubMed-linked sources.",
    sections: [
      {
        heading: "Sentence-level citation markers",
        body: [
          "Citation markers appear next to the answer sentences they support. In the preview, those markers are generated with the answer text and become clickable after the sentence is complete.",
        ],
      },
      {
        heading: "Evidence drawer",
        body: [
          "The evidence drawer stays closed by default so the answer remains readable. A reviewer can expand it to inspect the PubMed IDs, supporting sentence references, and source snippets.",
        ],
      },
    ],
  },
  {
    slug: "public-preview",
    title: "Answer workspace",
    description:
      "How the current BioEvidence answer workspace is organized.",
    sections: [
      {
        heading: "Available now",
        body: [
          "The answer workspace supports curated biomedical questions, saved answer outputs, switchable system configurations, typed answer generation, process visibility, and PubMed-linked evidence.",
        ],
      },
      {
        heading: "Account workspace",
        body: [
          "Accounts support sign-in, profile storage, access requests, and workspace pages for usage, saved questions, and settings.",
        ],
      },
    ],
  },
  {
    slug: "run-locally",
    title: "Run locally",
    description:
      "Start with public Examples, then add Supabase and a local worker for Live questions.",
    sections: [
      {
        heading: "Examples preview",
        body: [
          "Install Node.js 22 or newer, run npm ci and npm run dev, then open /ask?mode=examples. This preview uses bundled research examples and does not need Supabase, a PubMed index, or a language model.",
        ],
      },
      {
        heading: "Full Live workflow",
        body: [
          "Live questions additionally need a Supabase project with the repository migrations, matching website and worker secrets, Java 21, Python 3.12, a local Pyserini biomedical index, and Ollama with the configured Qwen model. The website accepts jobs; the separately running worker performs retrieval and generation.",
          "See the repository README and Supabase setup guide for exact environment variables and startup commands. Never commit your local environment files or Supabase service role key.",
        ],
      },
      {
        heading: "Research-use boundary",
        body: [
          "BioEvidence is a research product, not a clinical decision-support tool. Its answers and citations need human review and must not be used for diagnosis or treatment decisions.",
        ],
      },
    ],
  },
  {
    slug: "roadmap",
    title: "Roadmap",
    description:
      "Product work planned for BioEvidence AI.",
    sections: [
      {
        heading: "Near term",
        body: [
          "The next product pass will verify the full Live question-to-citation path, improve recovery when the local worker is offline, and make contributor setup reproducible on a fresh machine.",
          "Saved answer history, controlled usage limits, and API access remain product work, not prerequisites for exploring the public Examples preview.",
        ],
      },
      {
        heading: "Later",
        body: [
          "Planned additions include API keys, organization workspaces, saved questions, answer history, and additional thesis systems after defense and publication.",
        ],
      },
    ],
  },
  {
    slug: "faq",
    title: "FAQ",
    description:
      "Short answers about BioEvidence AI, accounts, and citation-grounded answers.",
    sections: [
      {
        heading: "Is this clinical advice?",
        body: [
          "No. BioEvidence AI is a research and product preview for evidence-grounded biomedical QA. It should not be used as medical diagnosis or treatment guidance.",
        ],
      },
      {
        heading: "Can users create accounts today?",
        body: [
          "Yes. BioEvidence supports Google sign-in, email sign-in links, profile storage, and access requests. Some workspace capabilities are access controlled.",
        ],
      },
      {
        heading: "Why show TREC BioGen results?",
        body: [
          "The shared-task results provide public evaluation context. They are not the whole product, but they explain where the current preview data came from.",
        ],
      },
    ],
  },
];

export function getDocPage(slug: string): BioEvidenceDoc | undefined {
  return docsPages.find((page) => page.slug === slug);
}
