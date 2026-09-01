"""Tests for the fuzzy matching utility."""

import pytest
from utils.matching import (
    levenshtein_distance,
    fuzzy_match_patient,
    find_patient_by_email,
    normalize_name,
)


class TestLevenshteinDistance:
    def test_identical_strings(self):
        assert levenshtein_distance("hello", "hello") == 1.0

    def test_completely_different(self):
        assert levenshtein_distance("abc", "xyz") < 0.5

    def test_empty_strings(self):
        assert levenshtein_distance("", "") == 1.0
        assert levenshtein_distance("", "abc") == 0.0
        assert levenshtein_distance("abc", "") == 0.0

    def test_case_insensitive(self):
        assert levenshtein_distance("Hello", "hello") == 1.0

    def test_partial_match(self):
        score = levenshtein_distance("Johnathan Doe", "John Doe")
        assert score > 0.7  # Should be a reasonable match


class TestFuzzyMatchPatient:
    def test_exact_match(self):
        result = fuzzy_match_patient("John Doe", ["John Doe", "Jane Smith"])
        assert result == "John Doe"

    def test_fuzzy_match(self):
        result = fuzzy_match_patient("Jon Doe", ["John Doe", "Jane Smith"])
        assert result == "John Doe"

    def test_no_match(self):
        result = fuzzy_match_patient("CompletelyDifferent", ["John Doe", "Jane Smith"])
        assert result is None

    def test_empty_candidates(self):
        result = fuzzy_match_patient("John Doe", [])
        assert result is None

    def test_empty_input(self):
        result = fuzzy_match_patient("", ["John Doe"])
        assert result is None

    def test_custom_threshold(self):
        result = fuzzy_match_patient(
            "Johnathan Doe",
            ["John Doe"],
            threshold=0.7,
        )
        assert result == "John Doe"


class TestFindPatientByEmail:
    def test_exact_email_match(self):
        result = find_patient_by_email(
            "john@example.com",
            ["john@example.com", "jane@example.com"],
        )
        assert result == "john@example.com"

    def test_fuzzy_email_match(self):
        result = find_patient_by_email(
            "jhon@example.com",
            ["john@example.com"],
        )
        assert result == "john@example.com"


class TestNormalizeName:
    def test_normalize(self):
        assert normalize_name("  John  Doe  ") == "john doe"

    def test_empty(self):
        assert normalize_name("") == ""
