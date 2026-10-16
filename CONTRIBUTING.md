# Contributing to BioEvidence

Thanks for helping make biomedical answers easier to inspect. BioEvidence has
two distinct surfaces: an Examples preview that runs without accounts, and an
experimental Live pipeline that needs Supabase plus a separate local worker.
Please keep that boundary clear in code and documentation.

## Before you start

1. Read the [README](README.md), especially the research-use boundary.
2. For UI or documentation work, run `npm ci` and `npm run dev`; no model or
   Supabase project is needed to inspect Examples.
3. For Live changes, use your own Supabase project and local environment files.
   Never include keys, user questions, patient information, downloaded models,
   or Lucene indexes in a commit, issue, screenshot, or test fixture.
4. Open an issue before introducing a new source, model, or account-data field.
   Explain expected latency, disk/memory cost, provenance, and failure behavior.

## Checks

```bash
npm run lint
npm run build
python3.12 -m unittest discover -s workers -p 'test_*.py'
```

The Python helper tests do not download models or indexes. If your change
touches retrieval or generation, describe how you exercised the full pipeline
and what was not possible to test locally.

## Pull requests

Keep changes focused. Include a short description, tests run, and screenshots
for visible UI changes. For answer or citation changes, include a synthetic
question and show how unsupported or unknown source IDs are handled. Do not
claim that an answer is medically correct solely because it has citations.

Good starting areas include mobile accessibility, Examples loading size,
worker offline/retry behavior, setup documentation, and reproducible
evaluation fixtures.
