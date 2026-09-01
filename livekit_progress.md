# Vanguard-Assist LiveKit Migration Progress

## Contract
- [ ] Full Pipecat/Daily reference audit and source list
- [ ] Feature-parity checklist derived from the current Pipecat implementation
- [ ] LiveKit CLI installed and local server reachable at ws://127.0.0.1:7880
- [ ] LIVEKIT_URL/API key/API secret configured without deleting legacy variables
- [ ] livekit-sip Windows deployment decision resolved
- [ ] Non-destructive backend and frontend LiveKit paths implemented and parity-tested
- [ ] Twilio/SIP bridge implemented only after the decision gate
- [ ] Cleanup performed only after parity sign-off

## Limits
Iteration cap: 15. Stagnation limit: 3.

### Iteration 1
- Targeted: Phase 0 repository audit.
- Action: Scanned the project root, backend, frontend, frontend backup, and all package/requirements files.
- Verify result: FAIL — requested frontend 2.0 directory, CallPage, Pipecat/Daily references, and current voice implementation are absent.
- Diagnosis: The connected project is a different patient-intake application, so no zero-loss feature-parity source exists.
- Checklist status: 0 / 8.

### Iteration 2
- Targeted: LiveKit installation and local reachability.
- Action: Installed LiveKit CLI 2.18.2 through winget and inspected its commands; tested ports 7880 and 6379.
- Verify result: PARTIAL — CLI installed, but it is a client CLI with no local server/dev subcommand; ports 7880 and 6379 are unreachable.
- Diagnosis: A separate LiveKit server and Redis service are required; neither is available in the current Windows environment.
- Checklist status: 1 / 8.

### Iteration 3
- Targeted: SIP deployment decision gate.
- Action: Read official LiveKit SIP documentation and repository deployment notes.
- Verify result: PASS — native operation is theoretically possible with Go/libopus/Redis, but Docker/Linux or LiveKit Cloud is the practical supported path for this project; SIP requires public 5060 and RTP 10000-20000.
- Diagnosis: Implementation cannot proceed because the source voice stack and required local LiveKit/Redis services are missing.
- Checklist status: 2 / 8.

