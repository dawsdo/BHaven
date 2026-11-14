---
name: mvp-plan
description: Start a hackathon MVP. Takes an idea and hours left, scopes it to one demoable core journey, then plans the build into slices. Use at the beginning of the hackathon or when the idea changes.
---

# /mvp-plan

Turn a raw idea into a scoped, sliced build plan.

## Steps
1. Collect the inputs if they are not already in the message: the idea, hours until demo, judging criteria, and team skills. Ask once for anything missing, then go on with stated assumptions.
2. Use the **mvp-scoper** agent to write `docs/mvp-scope.md`.
3. Show the user the one-line pitch, the core journey, and the cut list. Ask them to confirm or trim the scope. Stop here if they want changes, then rerun step 2 with their edits.
4. Once the scope is confirmed, use the **mvp-architect** agent to write `docs/mvp-plan.md`.
5. Report: stack, number of slices, estimated total hours, and the first slice to build. Suggest running `/mvp-build` next.

## Rules
- Never skip the scope step. A plan without a cut list will run out of time.
- If the estimated hours exceed the hours left, shrink the scope before planning slices.
