---
name: mvp-build
description: Build the next unfinished slice of the hackathon MVP plan, verify it runs, and report. Use repeatedly during the build phase. Pass a slice name to build a specific one.
---

# /mvp-build [slice name]

Implement one slice from `docs/mvp-plan.md`.

## Steps
1. Confirm `docs/mvp-plan.md` exists. If not, tell the user to run `/mvp-plan` first.
2. Use the **mvp-builder** agent. Pass the slice name if the user gave one; otherwise let it pick the first unticked slice.
3. When it reports back, show the user:
   - the slice that was completed
   - how it was verified
   - the known gaps
4. Ask whether to continue with the next slice or stop to review. Do not chain multiple slices without a check-in unless the user asks for that.

## Rules
- A slice counts as done only when its done check was run and passed.
- If the builder hits the fallback path, flag it clearly so the user can decide whether to keep it for the demo.
