#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
project_dir=$(CDPATH= cd -- "$script_dir/.." && pwd)
cd "$project_dir"

if [ -f .env.worker.local ]; then
  set -a
  . ./.env.worker.local
  set +a
fi

export PYSERINI_CACHE="${PYSERINI_CACHE:-$project_dir/.cache/pyserini}"
export HF_HOME="${HF_HOME:-$project_dir/.cache/huggingface}"
export BIOEVIDENCE_BASE_URL="${BIOEVIDENCE_BASE_URL:-http://127.0.0.1:3000}"
export BIOEVIDENCE_RETRIEVAL_PATH="${BIOEVIDENCE_RETRIEVAL_PATH:-adaptive}"
export BIOEVIDENCE_ONLINE_SOURCES="${BIOEVIDENCE_ONLINE_SOURCES:-auto}"
export OLLAMA_MODEL="${OLLAMA_MODEL:-qwen3.5:4b-q4_K_M}"

if [ ! -x .venv-worker/bin/python ]; then
  printf '%s\n' "Missing .venv-worker. Install workers/requirements-worker.txt first." >&2
  exit 2
fi

exec .venv-worker/bin/python workers/live_qa_worker.py "$@"
