#!/usr/bin/env python3
"""Local BioEvidence worker for the production live QA queue."""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from bioevidence_pipeline import BioEvidencePipeline, PipelineConfig


BASE_URL = os.environ.get("BIOEVIDENCE_BASE_URL", "http://localhost:3000").rstrip("/")
WORKER_SECRET = os.environ.get("LIVE_QA_WORKER_SECRET", "")
WORKER_ID = os.environ.get("BIOEVIDENCE_WORKER_ID", "local-worker")


def request_json(
    method: str,
    path: str,
    payload: dict[str, Any] | None = None,
    authorized: bool = True,
) -> dict[str, Any]:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"Content-Type": "application/json"}
    if authorized:
        headers["Authorization"] = f"Bearer {WORKER_SECRET}"

    request = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=data,
        headers=headers,
        method=method,
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {path} failed: {error.code} {body}") from error


def claim_next_job() -> dict[str, Any] | None:
    params = urllib.parse.urlencode({"worker_id": WORKER_ID})
    payload = request_json("GET", f"/api/live/worker/jobs/next?{params}")
    return payload.get("job")


def update_job(job_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    return request_json("PATCH", f"/api/live/worker/jobs/{job_id}", payload)


def event(job_id: str, stage: str, title: str, detail: str, status: str = "running"):
    update_job(
        job_id,
        {
            "event": {
                "detail": detail,
                "stage": stage,
                "status": status,
                "title": title,
            }
        },
    )


def heartbeat(
    status: str = "online",
    current_job_id: str | None = None,
    error_message: str | None = None,
) -> None:
    request_json(
        "POST",
        "/api/live/worker/status",
        {
            "currentJobId": current_job_id,
            "errorMessage": error_message,
            "metadata": {
                "model": os.environ.get("OLLAMA_MODEL", "qwen3.5:4b-q4_K_M"),
                "retrievalPath": os.environ.get(
                    "BIOEVIDENCE_RETRIEVAL_PATH", "adaptive"
                ),
            },
            "status": status,
            "workerId": WORKER_ID,
        },
    )


def run_pipeline(job: dict[str, Any], pipeline: BioEvidencePipeline) -> None:
    job_id = job["id"]
    question = job["question"]

    def report(stage: str, title: str, detail: str, status: str) -> None:
        event(job_id, stage, title, detail, status)
        heartbeat("busy", job_id)

    last_draft = ""

    def publish_draft(answer_text: str) -> None:
        nonlocal last_draft
        if answer_text == last_draft:
            return
        last_draft = answer_text
        update_job(job_id, {"answerText": answer_text, "status": "running"})

    result = pipeline.run(question, report, publish_draft)
    update_job(
        job_id,
        {
            "answerCitations": result.answer_citations,
            "answerText": result.answer_text,
            "event": {
                "detail": "Answer and evidence trail are ready for review.",
                "stage": "complete",
                "status": "completed",
                "title": "Answer ready",
                "payload": result.trace,
            },
            "sources": result.sources,
            "status": "completed",
        },
    )


def main() -> int:
    if not WORKER_SECRET:
        print("Set LIVE_QA_WORKER_SECRET before starting the worker.", file=sys.stderr)
        return 2

    run_once = "--once" in sys.argv
    try:
        pipeline = BioEvidencePipeline(PipelineConfig.from_environment())
    except Exception as error:  # noqa: BLE001 - startup errors should be readable.
        print(f"Worker configuration failed: {error}", file=sys.stderr)
        return 2

    print(f"BioEvidence worker listening at {BASE_URL} as {WORKER_ID}")
    last_heartbeat = 0.0

    try:
        while True:
            if time.monotonic() - last_heartbeat > 15:
                heartbeat("online")
                last_heartbeat = time.monotonic()
            job = claim_next_job()
            if not job:
                if run_once:
                    print("No queued jobs.")
                    heartbeat("offline")
                    return 0
                time.sleep(2)
                continue

            job_id = job["id"]
            print(f"Running job {job_id}: {job['question']}")
            heartbeat("busy", job_id)
            try:
                run_pipeline(job, pipeline)
                heartbeat("online")
            except Exception as error:  # noqa: BLE001 - worker must report failures.
                update_job(
                    job_id,
                    {
                        "errorMessage": str(error),
                        "event": {
                            "detail": str(error),
                            "stage": "failed",
                            "status": "failed",
                            "title": "Worker failed",
                        },
                        "status": "failed",
                    },
                )
                heartbeat("error", error_message=str(error))
                print(f"Job {job_id} failed: {error}", file=sys.stderr)

            if run_once:
                heartbeat("offline")
                return 0
    except KeyboardInterrupt:
        print("Stopping BioEvidence worker.")
        try:
            heartbeat("offline")
        except Exception:  # noqa: BLE001 - shutdown should not hang on network failure.
            pass
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
