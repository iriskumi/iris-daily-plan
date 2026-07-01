# English Output Journey Notes

## What changed

- Added a long-term English Output Journey tracker for active English production.
- Target is `10,000` valid output reps.
- Milestones are non-linear:
  - `100, 200, 300, 500, 800, 1000, 1500, 2000, 3000, 5000, 7000, 10000`
- Added a compact Study tab card showing:
  - total reps
  - current milestone progress
  - next milestone
  - long-term progress to 10,000
  - today’s reps
  - last 7 days reps
- Added manual controls:
  - `+1 Manual Output Rep`
  - `Undo last rep`
  - optional manual note field

## Counting logic

- A completed Study session automatically adds reps when:
  - category is `English Output`, or
  - the source template has `type: 'output'` and the template category includes `English`
- The Study session must be at least 5 actual minutes.
- Rep count is based on planned/actual minutes:
  - 5-29 min = 1 rep
  - 30-59 min = 2 reps
  - 60-89 min = 3 reps
  - 90+ min = 4 reps max
- English Input sessions do not count unless a future template explicitly has an output type.
- Duplicate Study session reps are prevented by storing `sessionId` in history.
- Manual `+1` is intended only for English output done outside the Study timer.

## Storage

- New localStorage key:
  - `iris-english-output-journey`
- Shape:
  - `totalReps`
  - `milestones`
  - `history`

## Study Review and Markdown

- Study Review now shows:
  - English Output Reps today
  - English Output Reps this week
  - English Output Reps total
  - current milestone progress
- Markdown export now includes:
  - `## English Output Journey`
  - Today reps
  - This week reps
  - Total reps out of 10,000
  - Current milestone progress
- Notion Study Daily Log receives this through the existing Markdown payload.
- No Notion database schema change was made.

## Safety

- Study timer behavior was not changed.
- Study session storage remains unchanged.
- taskStore behavior remains unchanged.
- Today / Plan / Tasks were not changed.
- Existing localStorage keys were preserved.

## Manual QA

1. Complete an `English Output` Study session of at least 5 minutes.
2. Confirm total reps increases by duration: 25 min = 1 rep, 50 min = 2 reps.
3. Complete/trigger the same session again and confirm it does not duplicate.
4. Complete an `English Input` session and confirm it does not count.
5. Use `+1 Manual Output Rep` with a note for outside-app practice.
6. Use `Undo last rep`.
7. Confirm Study Review shows today, week, total, and milestone progress.
8. Copy Markdown and confirm the English Output Journey section appears.
9. Confirm Notion Study Daily Log push still works through existing Markdown.
