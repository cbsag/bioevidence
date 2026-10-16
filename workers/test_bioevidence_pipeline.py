from __future__ import annotations

import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from bioevidence_pipeline import (
    Candidate,
    PipelineConfig,
    _parse_string_array,
    evidence_coverage_score,
    parse_question_plan,
    validate_answer_citations,
)


class PipelineHelpersTest(unittest.TestCase):
    def test_parse_json_reformulations(self) -> None:
        raw = 'Here you go: ["clinical query", "mechanism query", "outcome query"]'
        self.assertEqual(
            _parse_string_array(raw),
            ["clinical query", "mechanism query", "outcome query"],
        )

    def test_invalid_pmids_are_removed(self) -> None:
        evidence = [Candidate(pmid="123", content="Evidence one")]
        answer, citations = validate_answer_citations(
            "Supported claim [PMID: 123]. Invented claim [PMID: 999].",
            evidence,
        )
        self.assertIn("[PMID: 123]", answer)
        self.assertNotIn("999", answer)
        self.assertEqual(
            citations,
            [
                {
                    "labels": ["PMID: 123"],
                    "pmids": ["123"],
                    "source_ids": ["123"],
                }
            ],
        )

    def test_trial_citation_is_validated(self) -> None:
        evidence = [
            Candidate(
                content="Registered trial evidence",
                source_id="NCT01234567",
                source_type="clinical_trials",
            )
        ]
        answer, citations = validate_answer_citations(
            "A relevant trial is registered [NCT: NCT01234567].", evidence
        )
        self.assertIn("[NCT: NCT01234567]", answer)
        self.assertEqual(citations[0]["source_ids"], ["NCT01234567"])

    def test_missing_index_configuration_is_rejected(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            config = PipelineConfig.from_environment()
        with self.assertRaisesRegex(RuntimeError, "BIOEVIDENCE_BM25_INDEX"):
            config.validate()

    def test_existing_index_directory_is_accepted(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            config = PipelineConfig(bm25_index=Path(directory))
            config.validate()

    def test_question_plan_adapts_query_and_evidence_depth(self) -> None:
        raw = """{
          "summary": "Compare mechanisms and outcomes.",
          "intent": "comparative effectiveness",
          "complexity": "complex",
          "retrieval_path": "dense",
          "answer_depth": "deep",
          "queries": ["drug A vs drug B", "drug A mechanism", "drug B outcomes"]
        }"""
        plan = parse_question_plan(raw, "How do drug A and drug B compare?")
        self.assertEqual(plan.retrieval_path, "dense")
        self.assertEqual(plan.answer_depth, "deep")
        self.assertEqual(len(plan.queries), 4)
        self.assertEqual(plan.evidence_count, 10)

    def test_invalid_plan_falls_back_safely(self) -> None:
        plan = parse_question_plan("not json", "What treats migraine?")
        self.assertEqual(plan.retrieval_path, "sparse")
        self.assertEqual(len(plan.queries), 3)
        self.assertEqual(plan.queries[0], "What treats migraine?")

    def test_evidence_coverage_uses_question_terms(self) -> None:
        evidence = [
            Candidate(
                pmid="123",
                content="Migraine prevention with a CGRP antibody reduced headaches.",
            )
        ]
        score = evidence_coverage_score("Does CGRP prevent migraine headaches?", evidence)
        self.assertGreaterEqual(score, 0.75)


if __name__ == "__main__":
    unittest.main()
