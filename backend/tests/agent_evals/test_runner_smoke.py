"""Smoke test: runner returns the right types for a trivial fixture.

Run first to fail (before runner.py exists), then pass.
"""
import pytest
from tests.agent_evals.fixtures import Fixture
from tests.agent_evals.runner import EvalReport, FixtureResult, run_evals


def test_runner_returns_fixture_result() -> None:
    trivial: Fixture = {
        "name": "smoke_test",
        "messages": [{"role": "user", "content": "hello"}],
        "expected_mode": "info",
        "expected_tools_any_of": [[]],
        "must_extract": {},
    }
    report = run_evals([trivial])
    assert isinstance(report, EvalReport)
    assert len(report.results) == 1
    result = report.results[0]
    assert isinstance(result, FixtureResult)
    assert result.name == "smoke_test"
    assert result.actual_mode == "info"
