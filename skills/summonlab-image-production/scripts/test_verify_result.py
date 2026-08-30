#!/usr/bin/env python3
"""Focused tests for image-production result failure classification."""

from __future__ import annotations

import unittest

from verify_result import verify_failure_kind_contract


class FailureKindContractTests(unittest.TestCase):
    def test_terminal_provider_failure_requires_valid_classification(self) -> None:
        verify_failure_kind_contract(
            {"conclusion": "provider-failure", "failureKind": "capacity"}, "failed"
        )
        with self.assertRaisesRegex(ValueError, "must classify"):
            verify_failure_kind_contract({"conclusion": "provider-failure"}, "failed")
        with self.assertRaisesRegex(ValueError, "is invalid"):
            verify_failure_kind_contract(
                {"conclusion": "provider-failure", "failureKind": "network-ish"}, "failed"
            )

    def test_legacy_nonterminal_provider_failure_may_omit_classification(self) -> None:
        verify_failure_kind_contract({"conclusion": "provider-failure"}, "revise")

    def test_non_provider_attempt_cannot_claim_failure_classification(self) -> None:
        with self.assertRaisesRegex(ValueError, "only provider-failure"):
            verify_failure_kind_contract(
                {"conclusion": "accepted-by-producer", "failureKind": "capacity"}, "candidate"
            )


if __name__ == "__main__":
    unittest.main()
