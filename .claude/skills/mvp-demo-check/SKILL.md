---
name: mvp-demo-check
description: Final pre-judging check for the hackathon MVP. Runs the core demo path from a clean state, writes README and pitch script, and lists demo-day risks. Use in the last few hours before submission or judging.
---

# /mvp-demo-check

Confirm the demo works and the submission is ready.

## Steps
1. Use the **demo-prep** agent.
2. It runs the core journey and reports pass or fail, with the failing step if any.
3. If something fails, fix only the blocking issue. Do not add features at this stage. Rerun the check.
4. Show the user the README and `docs/pitch.md` for a final read.
5. Give a short checklist: env vars set on the demo machine, seed data loaded, fallback ready, laptop charged, and the demo path bookmarked.

## Rules
- Do not mark the check as passed unless the core journey ran end to end in this session.
- Anything stubbed must be called "mocked" in the pitch. Do not overstate what is real.
