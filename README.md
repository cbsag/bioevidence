# BioEvidence

BioEvidence is an open-source biomedical question-answering workspace built to
make retrieval, evidence selection, generation, and citations inspectable.

There are two ways to run it. **Examples preview** works from a fresh checkout
without accounts or models. **Live mode** adds Supabase, a local Pyserini index,
rerankers, and an Ollama-hosted Qwen model. Live mode is a research beta: the
worker must be running, and end-to-end validation is still in progress.

BioEvidence is **not medical advice or a clinical decision-support tool**.
Do not use generated answers for diagnosis or treatment decisions.

Website: [bioevidence.cbsag.me](https://bioevidence.cbsag.me/) ·
Public Examples: [Ask → Examples](https://bioevidence.cbsag.me/ask?mode=examples)

The original code and documentation are available under Apache-2.0; see
[LICENSE](LICENSE). Archived benchmark data and imagery have separate provenance
and reuse considerations in [DATA_AND_ASSETS.md](DATA_AND_ASSETS.md).

## Quick start: Examples preview

Requirements: Node.js 22 or newer and npm.

```bash
git clone https://github.com/cbsag/bioevidence.git
cd bioevidence
npm ci
npm run dev
```

Open `http://localhost:3000/ask?mode=examples`. No `.env` file, Supabase
project, PubMed index, or Ollama installation is needed for this preview.
The bundled example traces are archived research outputs; they do not run the
live pipeline.

## Product Surfaces

- Live answer workspace at `/ask` when configured.
- Supabase-backed auth, request access, profile, usage, and settings pages.
- Realtime pipeline events for live QA jobs.
- Local Python worker for adaptive Pyserini retrieval, sparse/dense reranking,
  Qwen generation through Ollama, and source-ID validation.
- Search-first archived examples from the TREC BioGen Task B work.
- Five public system outputs from the submitted TREC BioGen runs.
- PubMed-linked citation chips for generated answer sentences.
- Official answer-quality and citation-quality result tables.

## Live QA Architecture

Live QA is job-based:

1. A signed-in user submits a question on `/ask`.
2. `POST /api/live/jobs` creates a Supabase `qa_jobs` row.
3. A local or hosted worker claims pending work from
   `GET /api/live/worker/jobs/next`.
4. The worker writes `qa_events`, `qa_sources`, and the final answer through
   `PATCH /api/live/worker/jobs/:jobId`.
5. The browser listens to Supabase Realtime and updates the process trail,
   answer, and evidence list live.

The worker routes require `LIVE_QA_WORKER_SECRET`. The site uses
`SUPABASE_SERVICE_ROLE_KEY` only on the server so the browser never receives
pipeline credentials.

## Static Data and API

The examples still use saved TREC BioGen outputs. Optional server-side PubMed
requests supply article metadata and citation search without exposing
credentials to the browser.

The Next.js app reads:

- `data/shared-task/topics.json`
- `data/shared-task/system-a.jsonl`
- `data/shared-task/system-b.jsonl`
- `data/shared-task/system-c.jsonl`
- `data/shared-task/system-d.jsonl`
- `data/shared-task/system-e.jsonl`

The app exposes these serverless routes:

- `GET /api/health`
- `GET /api/systems`
- `GET /api/search?q=statin&systems=System%20A,System%20D`
- `GET /api/pubmed?pmids=12345678,23456789`
- `GET /api/cite?sentence=...&retmax=5`
- `GET /api/live/jobs`
- `POST /api/live/jobs`
- `GET /api/live/jobs/:jobId`
- `GET /api/live/worker/jobs/next`
- `PATCH /api/live/worker/jobs/:jobId`
- `GET|POST /api/live/worker/status`

The search and systems endpoints preserve the response shape used by the
original viewer. PubMed endpoints call the official NCBI E-utilities service.

## Full local Live mode

Live mode is substantially heavier than the Examples preview. It requires a
Supabase project, Java 21, Python 3.12, enough disk space for a local
biomedical Lucene index and model caches, and an Ollama model. Review the
upstream model/index licenses and storage requirements before downloading.

1. Create a Supabase project and follow [the migration and auth setup](supabase/README.md).
2. Copy `.env.example` to `.env.local`. Fill in your own Supabase URL,
   publishable key, service role key, and a long random
   `LIVE_QA_WORKER_SECRET`. Keep `.env.local` private.
3. Install Python 3.12 and Java 21. Create the isolated worker environment:

   ```bash
   python3.12 -m venv .venv-worker
   .venv-worker/bin/pip install -r workers/requirements-worker.txt
   ```

4. Obtain a compatible local Pyserini/Lucene biomedical index. For example,
   Pyserini provides the prebuilt `beir-v1.0.0-bioasq.flat` index:

   ```bash
   .venv-worker/bin/python -c 'from pyserini.search.lucene import LuceneSearcher; LuceneSearcher.from_prebuilt_index("beir-v1.0.0-bioasq.flat")'
   ```

   This is a **large download** (roughly 28 GB unpacked on our test Mac),
   so check free space and your network first. Find its directory under
   `~/.cache/pyserini/indexes/` and set that absolute directory as
   `BIOEVIDENCE_BM25_INDEX` in the ignored `.env.worker.local`. See
   [Pyserini's index catalog](https://github.com/castorini/pyserini/blob/master/docs/prebuilt-indexes.md)
   for details. BioASQ is a biomedical research corpus, **not the complete or
   current PubMed corpus**; use your own current PubMed index if full coverage
   matters. No index is included in this repository, and the worker checks
   the directory at startup.
5. Install and start Ollama, then pull the configured model:

   ```bash
   ollama pull qwen3.5:4b-q4_K_M
   ollama list
   ```

6. Copy `.env.worker.example` to `.env.worker.local`. Set the same
   `LIVE_QA_WORKER_SECRET` as `.env.local`, your index path, and
   `BIOEVIDENCE_BASE_URL=http://127.0.0.1:3000`.
7. Start the website with `npm run dev`. In a second terminal run
   `npm run worker:live`, then sign in and open `/ask`.

The worker selects 2–4 searches, an adaptive sparse or dense reranking path,
and evidence/answer depth from the question. It can optionally check fresh
NCBI, Europe PMC, and ClinicalTrials.gov records. It publishes a process trace,
streams a draft, and removes source IDs that are not in selected evidence.
The process trace is **not** hidden chain-of-thought.

The worker script uses project-local cache directories by default. Set
`PYSERINI_CACHE`, `HF_HOME`, `JAVA_HOME`, and model variables if your system
needs different paths. Avoid putting model weights or indexes in Git.

## Checks

```bash
npm run lint
npm run build
python3.12 -m unittest discover -s workers -p 'test_*.py'
```

## Deployment

The Next.js website can deploy on Vercel; the heavy worker runs separately on
your own machine or infrastructure. Vercel alone does not execute the pipeline.

Recommended Vercel settings:

- Framework preset: Next.js
- Root directory: repository root
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: Next.js default
- Environment variables: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `LIVE_QA_WORKER_SECRET`, `PUBMED_API_KEY`
  optional, `CONTACT_EMAIL` recommended, and `TOOL_NAME` optional

`vercel.json` enforces the Next.js framework preset and clears the legacy
`public` output-directory setting used by the original static viewer.

The app works without a PubMed API key, subject to NCBI's lower unauthenticated
request rate. Environment variables must be configured in Vercel, never
committed to this repository.

Do not point a public production website at a worker until job recovery,
offline status, auth, source attribution, and rate limits have been tested with
your own Supabase project.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local checks, project boundaries,
and starter contribution areas. Please open an issue before adding a new
retrieval source, model dependency, or user-data surface so the behavior and
resource cost can be reviewed together.
