#!/usr/bin/env python3
"""Adaptive, Mac-friendly BioEvidence pipeline used by the live QA worker.

The product pipeline keeps the useful thesis components (common local PubMed
BM25 retrieval, sparse/dense reranking, and evidence-grounded generation) while
removing benchmark-only rules. Query count, retrieval route, evidence depth,
and response depth are selected for each question.

Large dependencies are imported lazily. This lets the worker start with a clear
configuration error instead of failing during module import.
"""

from __future__ import annotations

from dataclasses import dataclass
import json
import os
from pathlib import Path
import re
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from typing import Any, Callable, Iterable, Iterator, Sequence


ProgressCallback = Callable[[str, str, str, str], None]
DraftCallback = Callable[[str], None]


@dataclass(frozen=True)
class PipelineConfig:
    bm25_index: Path | None
    ollama_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "qwen3.5:4b-q4_K_M"
    retrieval_path: str = "adaptive"
    bm25_per_query: int = 40
    max_rerank_candidates: int = 48
    max_evidence_count: int = 10
    online_sources: str = "auto"
    fresh_per_source: int = 6
    ncbi_api_key: str | None = None
    ncbi_email: str | None = None
    sparse_model: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    medcpt_query_model: str = "ncbi/MedCPT-Query-Encoder"
    medcpt_doc_model: str = "ncbi/MedCPT-Article-Encoder"
    medcpt_cross_model: str = "ncbi/MedCPT-Cross-Encoder"
    model_timeout_seconds: int = 300

    @classmethod
    def from_environment(cls) -> "PipelineConfig":
        raw_index = os.environ.get("BIOEVIDENCE_BM25_INDEX", "").strip()
        path = os.environ.get("BIOEVIDENCE_RETRIEVAL_PATH", "adaptive").strip().lower()
        if path not in {"adaptive", "sparse", "dense"}:
            raise ValueError(
                "BIOEVIDENCE_RETRIEVAL_PATH must be 'adaptive', 'sparse', or 'dense'."
            )
        online_sources = os.environ.get("BIOEVIDENCE_ONLINE_SOURCES", "auto").strip().lower()
        if online_sources not in {"auto", "off", "required"}:
            raise ValueError(
                "BIOEVIDENCE_ONLINE_SOURCES must be 'auto', 'off', or 'required'."
            )
        return cls(
            bm25_index=Path(raw_index).expanduser() if raw_index else None,
            ollama_url=os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/"),
            ollama_model=os.environ.get("OLLAMA_MODEL", "qwen3.5:4b-q4_K_M"),
            retrieval_path=path,
            bm25_per_query=_positive_int("BIOEVIDENCE_BM25_PER_QUERY", 40),
            max_rerank_candidates=_positive_int(
                "BIOEVIDENCE_MAX_RERANK_CANDIDATES", 48
            ),
            max_evidence_count=_positive_int("BIOEVIDENCE_MAX_EVIDENCE_COUNT", 10),
            online_sources=online_sources,
            fresh_per_source=_positive_int("BIOEVIDENCE_FRESH_PER_SOURCE", 6),
            ncbi_api_key=os.environ.get("NCBI_API_KEY") or None,
            ncbi_email=os.environ.get("NCBI_EMAIL") or None,
            sparse_model=os.environ.get(
                "BIOEVIDENCE_SPARSE_RERANKER",
                "cross-encoder/ms-marco-MiniLM-L-6-v2",
            ),
            medcpt_query_model=os.environ.get(
                "BIOEVIDENCE_MEDCPT_QUERY_MODEL", "ncbi/MedCPT-Query-Encoder"
            ),
            medcpt_doc_model=os.environ.get(
                "BIOEVIDENCE_MEDCPT_DOC_MODEL", "ncbi/MedCPT-Article-Encoder"
            ),
            medcpt_cross_model=os.environ.get(
                "BIOEVIDENCE_MEDCPT_CROSS_MODEL", "ncbi/MedCPT-Cross-Encoder"
            ),
            model_timeout_seconds=_positive_int("BIOEVIDENCE_MODEL_TIMEOUT", 300),
        )

    def validate(self) -> None:
        if self.bm25_index is None:
            raise RuntimeError(
                "Set BIOEVIDENCE_BM25_INDEX to the local Pyserini PubMed index."
            )
        if not self.bm25_index.is_dir():
            raise RuntimeError(
                f"The PubMed BM25 index does not exist: {self.bm25_index}"
            )


@dataclass(frozen=True)
class QuestionPlan:
    summary: str
    intent: str
    complexity: str
    retrieval_path: str
    answer_depth: str
    queries: list[str]

    @property
    def evidence_count(self) -> int:
        return {"focused": 5, "standard": 7, "deep": 10}.get(self.answer_depth, 7)

    @property
    def rerank_count(self) -> int:
        return {"focused": 24, "standard": 36, "deep": 48}.get(
            self.answer_depth, 36
        )


@dataclass
class Candidate:
    content: str
    source_type: str = "pubmed"
    source_id: str = ""
    pmid: str | None = None
    title: str | None = None
    journal: str | None = None
    publication_year: str | None = None
    bm25_score: float = 0.0
    matched_queries: int = 1
    rerank_score: float = 0.0

    @property
    def canonical_id(self) -> str:
        return self.source_id or self.pmid or "unknown"

    @property
    def citation_label(self) -> str:
        if self.pmid:
            return f"PMID: {self.pmid}"
        if self.source_type == "clinical_trials":
            return f"NCT: {self.canonical_id}"
        return f"EPMC: {self.canonical_id}"

    def source_payload(self) -> dict[str, Any]:
        return {
            "journal": self.journal,
            "metadata": {
                "bm25_score": self.bm25_score,
                "matched_queries": self.matched_queries,
                "rerank_score": self.rerank_score,
            },
            "pmid": self.pmid,
            "publication_year": self.publication_year,
            "source_id": self.canonical_id,
            "source_type": self.source_type,
            "snippet": _snippet(self.content, 80),
            "title": self.title or _snippet(self.content, 18),
            "url": self._url(),
        }

    def _url(self) -> str:
        if self.source_type == "clinical_trials":
            return f"https://clinicaltrials.gov/study/{self.canonical_id}"
        if self.source_type == "europe_pmc" and not self.pmid:
            return f"https://europepmc.org/article/MED/{self.canonical_id}"
        return f"https://pubmed.ncbi.nlm.nih.gov/{self.pmid}/"


@dataclass
class PipelineResult:
    answer_text: str
    answer_citations: list[dict[str, Any]]
    sources: list[dict[str, Any]]
    trace: dict[str, Any]


class OllamaClient:
    def __init__(self, base_url: str, model: str, timeout_seconds: int):
        self.base_url = base_url
        self.model = model
        self.timeout_seconds = timeout_seconds

    def chat(self, prompt: str, *, temperature: float = 0.2) -> str:
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "options": {"temperature": temperature},
            "stream": False,
            "think": False,
        }
        response = self._request(payload)
        return str((response.get("message") or {}).get("content") or "").strip()

    def stream_chat(self, prompt: str, *, temperature: float = 0.15) -> Iterator[str]:
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "options": {"temperature": temperature},
            "stream": True,
            "think": False,
        }
        request = urllib.request.Request(
            f"{self.base_url}/api/chat",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                for raw_line in response:
                    if not raw_line.strip():
                        continue
                    item = json.loads(raw_line.decode("utf-8"))
                    chunk = str((item.get("message") or {}).get("content") or "")
                    if chunk:
                        yield chunk
        except urllib.error.URLError as error:
            raise RuntimeError(
                f"Could not reach Ollama at {self.base_url}. Start Ollama and ensure "
                f"model '{self.model}' is available."
            ) from error

    def _request(self, payload: dict[str, Any]) -> dict[str, Any]:
        request = urllib.request.Request(
            f"{self.base_url}/api/chat",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.URLError as error:
            raise RuntimeError(
                f"Could not reach Ollama at {self.base_url}. Start Ollama and ensure "
                f"model '{self.model}' is available."
            ) from error


class PubMedBM25Retriever:
    def __init__(self, index_path: Path):
        try:
            from pyserini.search.lucene import LuceneSearcher
        except ImportError as error:
            raise RuntimeError(
                "Pyserini is not installed. Install workers/requirements-worker.txt "
                "inside the BioEvidence worker environment."
            ) from error
        self.searcher = LuceneSearcher(str(index_path))

    def retrieve(self, queries: Sequence[str], per_query: int) -> list[Candidate]:
        merged: dict[str, Candidate] = {}
        for query in queries:
            for hit in self.searcher.search(query, k=per_query):
                candidate = self._candidate_from_hit(hit)
                if candidate is None:
                    continue
                current = merged.get(candidate.canonical_id)
                if current is None:
                    merged[candidate.canonical_id] = candidate
                else:
                    current.bm25_score = max(current.bm25_score, candidate.bm25_score)
                    current.matched_queries += 1
        return sorted(
            merged.values(),
            key=lambda item: (item.matched_queries, item.bm25_score),
            reverse=True,
        )

    @staticmethod
    def _candidate_from_hit(hit: Any) -> Candidate | None:
        pmid = str(getattr(hit, "docid", "")).strip()
        if not pmid:
            return None
        try:
            raw = hit.lucene_document.get("raw")
            record = json.loads(raw) if raw else {}
        except (AttributeError, TypeError, json.JSONDecodeError):
            record = {}
        content = _clean_text(
            record.get("contents")
            or record.get("abstract")
            or record.get("text")
            or ""
        )
        title = _clean_text(record.get("title") or "") or None
        if not content:
            return None
        return Candidate(
            pmid=pmid,
            source_id=pmid,
            content=content,
            title=title,
            journal=_clean_text(record.get("journal") or "") or None,
            publication_year=str(record.get("year") or "").strip() or None,
            bm25_score=float(getattr(hit, "score", 0.0)),
        )


class FreshEvidenceRetriever:
    """Best-effort adapters for current literature and registered trials."""

    def __init__(self, config: PipelineConfig):
        self.config = config

    def retrieve(self, queries: Sequence[str]) -> tuple[list[Candidate], list[str]]:
        candidates: list[Candidate] = []
        warnings: list[str] = []
        query = queries[0]
        adapters = [self._ncbi, self._europe_pmc]
        if _should_search_trials(query):
            adapters.append(self._clinical_trials)
        for adapter in adapters:
            try:
                candidates.extend(adapter(query))
            except (RuntimeError, urllib.error.URLError, TimeoutError, ET.ParseError) as error:
                warnings.append(str(error))
        return _deduplicate_candidates(candidates), warnings

    def _ncbi(self, query: str) -> list[Candidate]:
        parameters = {
            "db": "pubmed",
            "retmode": "json",
            "retmax": str(self.config.fresh_per_source),
            "sort": "pub date",
            "term": query,
            "tool": "BioEvidence",
        }
        if self.config.ncbi_api_key:
            parameters["api_key"] = self.config.ncbi_api_key
        if self.config.ncbi_email:
            parameters["email"] = self.config.ncbi_email
        search = _read_json_url(
            "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?"
            + urllib.parse.urlencode(parameters)
        )
        ids = [str(value) for value in search.get("esearchresult", {}).get("idlist", [])]
        if not ids:
            return []
        fetch_parameters = {
            "db": "pubmed",
            "id": ",".join(ids),
            "retmode": "xml",
            "rettype": "abstract",
            "tool": "BioEvidence",
        }
        if self.config.ncbi_api_key:
            fetch_parameters["api_key"] = self.config.ncbi_api_key
        if self.config.ncbi_email:
            fetch_parameters["email"] = self.config.ncbi_email
        xml = _read_url(
            "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?"
            + urllib.parse.urlencode(fetch_parameters)
        )
        result: list[Candidate] = []
        for article in ET.fromstring(xml).findall(".//PubmedArticle"):
            pmid = _xml_text(article.find(".//PMID"))
            title = _xml_text(article.find(".//ArticleTitle"))
            abstract = " ".join(
                _xml_text(item) for item in article.findall(".//AbstractText")
            ).strip()
            content = _clean_text(f"{title}. {abstract}")
            if pmid and content:
                result.append(
                    Candidate(
                        content=content,
                        journal=_xml_text(article.find(".//Journal/Title")) or None,
                        pmid=pmid,
                        publication_year=_publication_year(
                            _xml_text(article.find(".//PubDate"))
                        ),
                        source_id=pmid,
                        source_type="pubmed",
                        title=title or None,
                    )
                )
        return result

    def _europe_pmc(self, query: str) -> list[Candidate]:
        url = "https://www.ebi.ac.uk/europepmc/webservices/rest/search?" + urllib.parse.urlencode(
            {
                "format": "json",
                "pageSize": str(self.config.fresh_per_source),
                "query": query,
                "resultType": "core",
                "sort": "P_PDATE_D",
            }
        )
        payload = _read_json_url(url)
        result: list[Candidate] = []
        for record in payload.get("resultList", {}).get("result", []):
            if not isinstance(record, dict):
                continue
            pmid = str(record.get("pmid") or "").strip() or None
            source_id = pmid or str(record.get("pmcid") or record.get("id") or "").strip()
            title = _clean_text(record.get("title"))
            content = _clean_text(f"{title}. {record.get('abstractText') or ''}")
            if source_id and content:
                result.append(
                    Candidate(
                        content=content,
                        journal=_clean_text(record.get("journalTitle")) or None,
                        pmid=pmid,
                        publication_year=_publication_year(
                            str(record.get("firstPublicationDate") or "")
                        ),
                        source_id=source_id,
                        source_type="europe_pmc",
                        title=title or None,
                    )
                )
        return result

    def _clinical_trials(self, query: str) -> list[Candidate]:
        url = "https://clinicaltrials.gov/api/v2/studies?" + urllib.parse.urlencode(
            {"format": "json", "pageSize": str(self.config.fresh_per_source), "query.term": query}
        )
        payload = _read_json_url(url)
        result: list[Candidate] = []
        for record in payload.get("studies", []):
            protocol = record.get("protocolSection", {}) if isinstance(record, dict) else {}
            identification = protocol.get("identificationModule", {})
            description = protocol.get("descriptionModule", {})
            conditions = protocol.get("conditionsModule", {})
            outcomes = protocol.get("outcomesModule", {})
            nct_id = str(identification.get("nctId") or "").strip()
            title = _clean_text(
                identification.get("briefTitle") or identification.get("officialTitle")
            )
            outcome_text = " ".join(
                _clean_text(item.get("measure"))
                for item in outcomes.get("primaryOutcomes", [])
                if isinstance(item, dict)
            )
            content = _clean_text(
                " ".join(
                    [
                        title,
                        str(description.get("briefSummary") or ""),
                        " ".join(conditions.get("conditions", [])),
                        outcome_text,
                    ]
                )
            )
            if nct_id and content:
                result.append(
                    Candidate(
                        content=content,
                        source_id=nct_id,
                        source_type="clinical_trials",
                        title=title or None,
                    )
                )
        return result


class SparseReranker:
    def __init__(self, model_name: str):
        try:
            from sentence_transformers import CrossEncoder
        except ImportError as error:
            raise RuntimeError(
                "sentence-transformers is required for sparse reranking."
            ) from error
        self.model = CrossEncoder(model_name)

    def rerank(self, question: str, candidates: list[Candidate]) -> list[Candidate]:
        raw_scores = self.model.predict([(question, item.content) for item in candidates])
        if hasattr(raw_scores, "reshape"):
            raw_scores = raw_scores.reshape(-1).tolist()
        elif not isinstance(raw_scores, list):
            raw_scores = [raw_scores]
        scores = [float(score) for score in raw_scores]
        for candidate, score in zip(candidates, scores, strict=True):
            candidate.rerank_score = float(score)
        return sorted(candidates, key=lambda item: item.rerank_score, reverse=True)


class DenseMedCPTReranker:
    def __init__(self, config: PipelineConfig):
        try:
            import torch
            from transformers import AutoModel, AutoModelForSequenceClassification, AutoTokenizer
        except ImportError as error:
            raise RuntimeError("torch and transformers are required for dense reranking.") from error

        self.torch = torch
        if torch.backends.mps.is_available():
            self.device = torch.device("mps")
        else:
            self.device = torch.device("cpu")
        self.query_tokenizer = AutoTokenizer.from_pretrained(config.medcpt_query_model)
        self.query_model = AutoModel.from_pretrained(config.medcpt_query_model).to(self.device).eval()
        self.doc_tokenizer = AutoTokenizer.from_pretrained(config.medcpt_doc_model)
        self.doc_model = AutoModel.from_pretrained(config.medcpt_doc_model).to(self.device).eval()
        self.cross_tokenizer = AutoTokenizer.from_pretrained(config.medcpt_cross_model)
        self.cross_model = AutoModelForSequenceClassification.from_pretrained(
            config.medcpt_cross_model
        ).to(self.device).eval()

    def rerank(self, question: str, candidates: list[Candidate]) -> list[Candidate]:
        torch = self.torch
        with torch.inference_mode():
            query = self.query_tokenizer(
                question, return_tensors="pt", truncation=True, max_length=64
            )
            query = {key: value.to(self.device) for key, value in query.items()}
            query_vec = self.query_model(**query).last_hidden_state[:, 0, :]
            query_vec = torch.nn.functional.normalize(query_vec, p=2, dim=-1)

            dense_scores: list[float] = []
            for chunk in _chunks(candidates, 16):
                encoded = self.doc_tokenizer(
                    [item.content for item in chunk],
                    return_tensors="pt",
                    truncation=True,
                    max_length=256,
                    padding=True,
                )
                encoded = {key: value.to(self.device) for key, value in encoded.items()}
                vectors = self.doc_model(**encoded).last_hidden_state[:, 0, :]
                vectors = torch.nn.functional.normalize(vectors, p=2, dim=-1)
                dense_scores.extend((query_vec @ vectors.T).squeeze(0).float().cpu().tolist())

            shortlist = [
                item
                for item, _ in sorted(
                    zip(candidates, dense_scores, strict=True),
                    key=lambda pair: pair[1],
                    reverse=True,
                )[:24]
            ]

            for chunk in _chunks(shortlist, 8):
                encoded = self.cross_tokenizer(
                    [question] * len(chunk),
                    [item.content for item in chunk],
                    return_tensors="pt",
                    truncation=True,
                    max_length=512,
                    padding=True,
                )
                encoded = {key: value.to(self.device) for key, value in encoded.items()}
                logits = self.cross_model(**encoded).logits
                if logits.ndim == 2 and logits.size(-1) > 1:
                    logits = logits[:, 0]
                scores = logits.reshape(-1).float().cpu().tolist()
                for item, score in zip(chunk, scores, strict=True):
                    item.rerank_score = float(score)
        return sorted(shortlist, key=lambda item: item.rerank_score, reverse=True)


class BioEvidencePipeline:
    def __init__(self, config: PipelineConfig | None = None):
        self.config = config or PipelineConfig.from_environment()
        self.config.validate()
        self.ollama = OllamaClient(
            self.config.ollama_url,
            self.config.ollama_model,
            self.config.model_timeout_seconds,
        )
        assert self.config.bm25_index is not None
        self.retriever = PubMedBM25Retriever(self.config.bm25_index)
        self.fresh_retriever = FreshEvidenceRetriever(self.config)
        self.rerankers: dict[str, SparseReranker | DenseMedCPTReranker] = {}

    def run(
        self,
        question: str,
        progress: ProgressCallback,
        draft: DraftCallback,
    ) -> PipelineResult:
        progress(
            "understand",
            "Understanding the question",
            "Identifying the biomedical intent, complexity, and evidence needs.",
            "running",
        )
        plan = self._plan(question)
        progress(
            "understand",
            "Question understood",
            plan.summary,
            "completed",
        )

        progress(
            "reformulate",
            "Planning the evidence search",
            "Creating complementary searches based on the question's intent.",
            "running",
        )
        queries = plan.queries
        progress(
            "reformulate",
            f"{len(queries)} search queries ready",
            "The search breadth was selected for this question, not a benchmark quota.",
            "completed",
        )

        progress(
            "common_retrieval",
            "Running common PubMed retrieval",
            f"Searching the local PubMed index with {len(queries)} Pyserini BM25 queries.",
            "running",
        )
        candidates = self.retriever.retrieve(queries, self.config.bm25_per_query)
        if not candidates:
            raise RuntimeError("The local PubMed index returned no evidence candidates.")
        progress(
            "common_retrieval",
            "PubMed candidates collected",
            f"Collected {len(candidates)} unique PubMed records across the planned searches.",
            "completed",
        )

        fresh_warnings: list[str] = []
        fresh_candidates: list[Candidate] = []
        if self.config.online_sources != "off":
            progress(
                "source_expansion",
                "Checking fresh evidence sources",
                "Looking for current records in NCBI, Europe PMC, and relevant trial registrations.",
                "running",
            )
            fresh_candidates, fresh_warnings = self.fresh_retriever.retrieve(queries)
            if self.config.online_sources == "required" and fresh_warnings:
                raise RuntimeError("Fresh evidence retrieval failed: " + "; ".join(fresh_warnings))
            candidates = _deduplicate_candidates([*candidates, *fresh_candidates])
            progress(
                "source_expansion",
                "Fresh-source check complete",
                f"Added {len(fresh_candidates)} current literature or trial records."
                + (" Some sources were unavailable, so local retrieval was retained." if fresh_warnings else ""),
                "completed",
            )

        retrieval_path = (
            plan.retrieval_path
            if self.config.retrieval_path == "adaptive"
            else self.config.retrieval_path
        )
        path_label = (
            "Sparse cross-encoder" if retrieval_path == "sparse" else "Dense MedCPT"
        )
        progress(
            "path_selection",
            "Retrieval path selected",
            f"Using {path_label} because this question is {plan.complexity} complexity.",
            "completed",
        )
        progress(
            "rerank",
            "Reranking evidence",
            f"Scoring the strongest BM25 candidates with {path_label}.",
            "running",
        )
        rerank_count = min(plan.rerank_count, self.config.max_rerank_candidates)
        reranked = self._rerank(
            question, candidates[:rerank_count], retrieval_path
        )
        progress(
            "rerank",
            "Evidence reranked",
            f"Prioritized {len(reranked)} candidates for evidence selection.",
            "completed",
        )

        evidence_count = min(plan.evidence_count, self.config.max_evidence_count)
        evidence = reranked[:evidence_count]
        evidence_coverage = evidence_coverage_score(question, evidence)
        progress(
            "evidence_selection",
            "Selecting answer evidence",
            f"Selected {len(evidence)} records; estimated topic coverage is "
            f"{round(evidence_coverage * 100)}%.",
            "completed",
        )

        progress(
            "generate",
            "Generating cited answer",
            f"Generating locally with {self.config.ollama_model}; draft text will appear live.",
            "running",
        )
        raw_answer = self._generate(question, evidence, plan.answer_depth, draft)
        progress(
            "citation_linking",
            "Linking and validating citations",
            "Checking every answer citation against the selected evidence.",
            "running",
        )
        answer, citations = validate_answer_citations(raw_answer, evidence)
        draft(answer)
        progress(
            "citation_linking",
            "Citations linked",
            f"Validated {len({source_id for group in citations for source_id in group['source_ids']})} cited evidence sources.",
            "completed",
        )

        return PipelineResult(
            answer_text=answer,
            answer_citations=citations,
            sources=[item.source_payload() for item in evidence],
            trace={
                "understanding": plan.summary,
                "intent": plan.intent,
                "complexity": plan.complexity,
                "answer_depth": plan.answer_depth,
                "queries": queries,
                "retrieval_path": retrieval_path,
                "candidate_count": len(candidates),
                "evidence_coverage": evidence_coverage,
                "evidence_ids": [item.canonical_id for item in evidence],
                "fresh_candidate_count": len(fresh_candidates),
                "fresh_source_warnings": fresh_warnings,
            },
        )

    def _plan(self, question: str) -> QuestionPlan:
        prompt = (
            "Plan an evidence search for the biomedical question below. Return only one JSON "
            "object with these keys: summary (one sentence), intent (one short label), "
            "complexity (focused, standard, or complex), retrieval_path (sparse or dense), "
            "answer_depth (focused, standard, or deep), and queries (2 to 4 PubMed searches, "
            "including the original question). Use dense only for semantic, mechanistic, "
            "multi-hop, or terminology-mismatch questions; otherwise use sparse. Do not "
            "diagnose the user.\n\n"
            f"Question: {question}"
        )
        raw = self.ollama.chat(prompt, temperature=0.1)
        return parse_question_plan(raw, question)

    def _rerank(
        self, question: str, candidates: list[Candidate], retrieval_path: str
    ) -> list[Candidate]:
        reranker = self.rerankers.get(retrieval_path)
        if reranker is None:
            if retrieval_path == "dense":
                reranker = DenseMedCPTReranker(self.config)
            else:
                reranker = SparseReranker(self.config.sparse_model)
            self.rerankers[retrieval_path] = reranker
        return reranker.rerank(question, candidates)

    def _generate(
        self,
        question: str,
        evidence: Sequence[Candidate],
        answer_depth: str,
        draft: DraftCallback,
    ) -> str:
        evidence_block = "\n\n".join(
            f"[{index}] {item.citation_label}\n{_snippet(item.content, 180)}"
            for index, item in enumerate(evidence, start=1)
        )
        prompt = (
            "You are BioEvidence, an evidence-grounded biomedical question-answering system. "
            "Answer only from the supplied biomedical evidence. Be clear about uncertainty and "
            "do not give a personal diagnosis. Cite claims using the exact source label shown "
            "in brackets, such as [PMID: 12345678] or [NCT: NCT01234567]. Use only identifiers "
            "present below. Add a citation wherever a biomedical claim depends "
            "on a source; do not follow a fixed citation count. Organize and size the response "
            f"naturally for a {answer_depth} answer. If the evidence cannot support part of the "
            "question, say so explicitly.\n\n"
            f"QUESTION\n{question}\n\nEVIDENCE\n{evidence_block}\n\nANSWER"
        )
        parts: list[str] = []
        last_emitted_length = 0
        for chunk in self.ollama.stream_chat(prompt):
            parts.append(chunk)
            current = "".join(parts)
            if len(current) - last_emitted_length >= 80:
                draft(current)
                last_emitted_length = len(current)
        answer = "".join(parts).strip()
        if not answer:
            raise RuntimeError("The local answer model returned an empty response.")
        return answer


def validate_answer_citations(
    answer: str, evidence: Sequence[Candidate]
) -> tuple[str, list[dict[str, Any]]]:
    allowed: dict[str, set[str]] = {"PMID": set(), "NCT": set(), "EPMC": set()}
    for item in evidence:
        prefix = item.citation_label.split(":", 1)[0]
        allowed[prefix].add(item.canonical_id)
    citation_pattern = re.compile(
        r"\[(PMID|NCT|EPMC):\s*([A-Za-z0-9][A-Za-z0-9,._\-\s]*)\]",
        re.IGNORECASE,
    )

    def replace(match: re.Match[str]) -> str:
        prefix = match.group(1).upper()
        valid = [
            part.strip()
            for part in match.group(2).split(",")
            if part.strip() in allowed.get(prefix, set())
        ]
        if not valid:
            return ""
        return f"[{prefix}: " + ", ".join(dict.fromkeys(valid)) + "]"

    cleaned = citation_pattern.sub(replace, answer)
    cleaned = re.sub(r"[ \t]+\n", "\n", cleaned).strip()
    citations: list[dict[str, Any]] = []
    for paragraph in [part.strip() for part in re.split(r"\n+", cleaned) if part.strip()]:
        pmids: list[str] = []
        source_ids: list[str] = []
        labels: list[str] = []
        for match in citation_pattern.finditer(paragraph):
            prefix = match.group(1).upper()
            for source_id in match.group(2).split(","):
                value = source_id.strip()
                if value in allowed.get(prefix, set()) and value not in source_ids:
                    source_ids.append(value)
                    labels.append(f"{prefix}: {value}")
                    if prefix == "PMID":
                        pmids.append(value)
        if source_ids:
            citations.append(
                {"labels": labels, "pmids": pmids, "source_ids": source_ids}
            )
    if not citations:
        raise RuntimeError(
            "The answer model did not produce a valid citation to the selected evidence."
        )
    return cleaned, citations


def parse_question_plan(raw: str, question: str) -> QuestionPlan:
    """Normalize a small-model JSON plan and safely fill missing fields."""
    value: dict[str, Any] = {}
    match = re.search(r"\{[\s\S]*\}", raw)
    if match:
        try:
            parsed = json.loads(match.group(0))
            if isinstance(parsed, dict):
                value = parsed
        except json.JSONDecodeError:
            pass

    complexity = str(value.get("complexity") or "standard").strip().lower()
    if complexity not in {"focused", "standard", "complex"}:
        complexity = "standard"
    retrieval_path = str(value.get("retrieval_path") or "").strip().lower()
    if retrieval_path not in {"sparse", "dense"}:
        retrieval_path = _fallback_retrieval_path(question)
    answer_depth = str(value.get("answer_depth") or "").strip().lower()
    if answer_depth not in {"focused", "standard", "deep"}:
        answer_depth = {
            "focused": "focused",
            "standard": "standard",
            "complex": "deep",
        }[complexity]

    raw_queries = value.get("queries")
    query_values = raw_queries if isinstance(raw_queries, list) else []
    queries = _unique_queries([question, *[str(item) for item in query_values]])
    desired_queries = {"focused": 2, "standard": 3, "complex": 4}[complexity]
    for fallback in _fallback_reformulations(question):
        if len(queries) >= desired_queries:
            break
        queries = _unique_queries([*queries, fallback])

    return QuestionPlan(
        summary=_clean_text(value.get("summary"))
        or f"Evidence search for: {_snippet(question, 24)}",
        intent=_clean_text(value.get("intent")) or "biomedical evidence",
        complexity=complexity,
        retrieval_path=retrieval_path,
        answer_depth=answer_depth,
        queries=queries[:desired_queries],
    )


def evidence_coverage_score(question: str, evidence: Sequence[Candidate]) -> float:
    """Estimate whether selected records cover the question's meaningful terms."""
    question_terms = _meaningful_terms(question)
    if not question_terms:
        return 1.0 if evidence else 0.0
    evidence_terms = _meaningful_terms(" ".join(item.content for item in evidence))
    return len(question_terms & evidence_terms) / len(question_terms)


def _positive_int(name: str, default: int) -> int:
    raw = os.environ.get(name, str(default))
    try:
        value = int(raw)
    except ValueError as error:
        raise ValueError(f"{name} must be an integer.") from error
    if value < 1:
        raise ValueError(f"{name} must be positive.")
    return value


def _clean_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _snippet(text: str, max_words: int) -> str:
    words = _clean_text(text).split()
    value = " ".join(words[:max_words])
    return value + ("…" if len(words) > max_words else "")


def _parse_string_array(raw: str) -> list[str]:
    match = re.search(r"\[[\s\S]*\]", raw)
    if match:
        try:
            value = json.loads(match.group(0))
            if isinstance(value, list):
                return [str(item) for item in value if str(item).strip()]
        except json.JSONDecodeError:
            pass
    return [
        re.sub(r"^\s*(?:[-*]|\d+[.)])\s*", "", line).strip()
        for line in raw.splitlines()
        if line.strip()
    ]


def _fallback_reformulations(question: str) -> list[str]:
    return [
        f"Clinical evidence regarding {question}",
        f"Biomedical terminology and mechanisms for {question}",
        f"Outcomes prognosis and management evidence for {question}",
    ]


def _fallback_retrieval_path(question: str) -> str:
    semantic_cues = {
        "mechanism",
        "mechanisms",
        "pathway",
        "pathways",
        "why",
        "compare",
        "relationship",
        "association",
        "interact",
    }
    return "dense" if _meaningful_terms(question) & semantic_cues else "sparse"


def _unique_queries(values: Sequence[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for value in values:
        cleaned = _clean_text(value)
        key = cleaned.casefold()
        if cleaned and key not in seen:
            seen.add(key)
            result.append(cleaned)
    return result


def _meaningful_terms(value: str) -> set[str]:
    stopwords = {
        "about",
        "after",
        "among",
        "and",
        "are",
        "can",
        "does",
        "for",
        "from",
        "have",
        "how",
        "into",
        "most",
        "that",
        "the",
        "their",
        "there",
        "these",
        "this",
        "what",
        "when",
        "which",
        "with",
    }
    return {
        term
        for term in re.findall(r"[a-z0-9]+", value.casefold())
        if len(term) > 2 and term not in stopwords
    }


def _should_search_trials(question: str) -> bool:
    trial_terms = {
        "clinical",
        "intervention",
        "recruiting",
        "treatment",
        "trial",
        "trials",
        "therapy",
    }
    return bool(_meaningful_terms(question) & trial_terms)


def _deduplicate_candidates(candidates: Sequence[Candidate]) -> list[Candidate]:
    merged: dict[str, Candidate] = {}
    for candidate in candidates:
        key = candidate.pmid or f"{candidate.source_type}:{candidate.canonical_id}"
        current = merged.get(key)
        if current is None:
            merged[key] = candidate
            continue
        current.matched_queries = max(current.matched_queries, candidate.matched_queries)
        current.bm25_score = max(current.bm25_score, candidate.bm25_score)
        if len(candidate.content) > len(current.content):
            current.content = candidate.content
            current.title = candidate.title or current.title
            current.journal = candidate.journal or current.journal
            current.publication_year = candidate.publication_year or current.publication_year
    return sorted(
        merged.values(),
        key=lambda item: (item.matched_queries, item.bm25_score),
        reverse=True,
    )


def _read_json_url(url: str) -> dict[str, Any]:
    payload = json.loads(_read_url(url))
    if not isinstance(payload, dict):
        raise RuntimeError("Fresh evidence source returned an unexpected response.")
    return payload


def _read_url(url: str) -> str:
    request = urllib.request.Request(
        url,
        headers={"Accept": "application/json, application/xml", "User-Agent": "BioEvidence/1.0"},
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        raise RuntimeError(
            f"Fresh evidence source returned HTTP {error.code}."
        ) from error
    except urllib.error.URLError as error:
        raise RuntimeError("Fresh evidence source is currently unavailable.") from error


def _xml_text(element: ET.Element | None) -> str:
    if element is None:
        return ""
    return _clean_text("".join(element.itertext()))


def _publication_year(value: str) -> str | None:
    match = re.search(r"(?:19|20)\d{2}", value)
    return match.group(0) if match else None


def _chunks(items: Sequence[Any], size: int) -> Iterable[Sequence[Any]]:
    for index in range(0, len(items), size):
        yield items[index : index + size]
