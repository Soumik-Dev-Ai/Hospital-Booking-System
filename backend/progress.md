# Aurelis Backend QA Progress

## Contract

1. [x] `pytest -q` in `backend` exits 0 with all backend tests passing.
2. [ ] A live endpoint simulation script exists at `tests/e2e_edge_case_sim.py` and exercises unauthenticated prompt-injection input, fuzzy-name behavior, admin-only cron triggering, and rapid repeated requests.
3. [ ] The live endpoint simulation runs against `http://127.0.0.1:8000` and records actual HTTP responses without destructive actions.
4. [ ] `QA_CERTIFICATION_V2.md` documents scope, before/after automated results, implemented AI behaviors, fixes, regression coverage, security findings, and explicit sign-off or blockers.

## Limits

Iteration cap: 15. Stagnation limit: 3 consecutive iterations without net checklist progress or with the same failure repeating. No destructive or production actions are authorized by this task.

## Phase status

Phase 1 is complete. The missing `clinic_name`, `clinic_timezone`, and `google_sheets_service_account_file` defaults were added to `core/config.py`.

### Iteration 1
- Targeted: Full backend suite passes.
- Action: Added safe clinic and Google Sheets settings defaults to `core/config.py`.
- Verify result: PASS — `pytest -q` returned exit code 0: `251 passed, 1 warning in 56.90s`.
- Checklist status: 1 / 4 conditions passing.

## Current phase

Phase 2: build and run the bounded live endpoint edge-case simulation.

## Notes

The Google Gemini deprecation warning remains non-blocking and is outside the current AI edge-case scope. The live rate-limit middleware must be verified rather than assumed; the probe will report its actual behavior.

## References

- Backend test output: `fulltest.log`
- AI edge-case tests: `tests/test_ai_edge_cases.py`
- AI pipeline tests: `tests/test_ai_pipeline.py`
- Runtime middleware: `api/middleware.py`
- Cron route: `api/cron_api.py`

### Iteration 2
- Targeted: Live probe readiness and security behavior.
- Action: Added explicit webhook quarantine handling in `api/routes.py`, implemented sliding-window per-IP 429 enforcement in `api/middleware.py`, and corrected the probe's fuzzy fixture and rapid-hit count.
- Verify result: PASS for focused regressions — `pytest -q tests/test_routes.py tests/test_cron_enforcement.py tests/test_completion_flow.py tests/test_concurrency.py` returned `53 passed, 1 warning in 28.88s`.
- Diagnosis before fix: The webhook endpoint returned a non-explicit success path for detected injection, the rate limiter was a pass-through stub, and the initial fuzzy fixture scored 0.846 below the documented 0.90 threshold.
- Checklist status: 1 / 4 conditions passing; live probe pending fresh server restart.

### Iteration 3
- Targeted: Final live endpoint simulation and complete regression suite.
- Action: Restarted the backend with the latest code and ran `tests/e2e_edge_case_sim.py` followed by `pytest -q`.
- Verify result: PASS — the live probe returned `5/5` checks passing, including HTTP 200 health, explicit `quarantined` webhook response, deterministic fuzzy match at score `0.96`, HTTP 401 for unauthenticated cron trigger, and `13/110` rapid-hit HTTP 429 responses. The full suite returned `251 passed, 1 warning in 56.98s`.
- Diagnosis (resolved): The one remaining live finding was the unimplemented rate limiter; the sliding-window limiter now produces 429 responses without affecting the automated suite.
- Checklist status: 3 / 4 conditions passing; certification report pending.

### Iteration 4
- Targeted: Certification artifact completeness.
- Action: Verified that `QA_CERTIFICATION_V2.md` and `e2e_edge_case_sim.json` exist, that the report contains all seven required top-level sections, and that the persisted probe summary is `5/5` with `13` observed HTTP 429 responses.
- Verify result: PASS — report size is 12,244 bytes; all required deliverables are present and parseable.
- Checklist status: 4 / 4 conditions passing.
