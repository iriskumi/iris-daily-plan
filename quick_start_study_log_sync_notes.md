# Quick Start Study Log Sync Notes

## Purpose

Today Quick Start remains a low-pressure trace system. It still saves to Today traces first.

For eligible Quick Start sessions, the user can now optionally sync the completed session into the formal Study Log.

## Eligible actions

Eligible for Study Log sync:

- Study
- English
- Project
- Work / Resume

Not eligible by default:

- Move Body
- Life Admin
- Reset
- Before I Spiral

## Flow

1. User completes a Today Quick Start session.
2. User clicks `Save session`.
3. The original Today trace is saved exactly as before.
4. If the action is eligible, a small inline card asks whether to also sync to Study Log.
5. `只留今日痕迹` leaves Study Log unchanged.
6. `同步到 Study Log` creates a completed Study Session.
7. English sessions ask whether the session was active output or input only:
   - `English Output Rep`
   - `English Input only`

## Study session mapping

- Study -> `Review / NotebookLM`, title `Quick Start Study`
- English Output -> `English Output`, title `Quick Start English Output`
- English Input -> `English Input`, title `Quick Start English Input`
- Project -> `AI Coding`, title `Quick Start Project`
- Work / Resume -> `Job / Career`, title `Quick Start Career`

The synced StudySessionRecord uses:

- `source: today-quick-start`
- `sourceImportId: quickStartRecord.id`
- `plannedMinutes` from Quick Start duration
- `actualMinutes` from Quick Start completed duration

## Duplicate prevention

Synced Quick Start records are tracked in:

`iris-quick-start-study-syncs`

The sync also checks existing Study sessions for `source === "today-quick-start"` and matching `sourceImportId`, so repeated clicks do not create duplicate Study sessions.

## Counting boundaries

- Today traces still count the original Quick Start completion.
- Synced Study sessions count in Daily Study Log, Study Review, category breakdown, and Notion Study Daily Log.
- English Output Journey only updates when the user explicitly chooses `English Output Rep`.
- Pomodoro / Focus Garden is unchanged.

## Not changed

- No Study timer internals changed.
- No taskStore schema changed.
- No Notion or Obsidian export routes changed.
- No Media, Exercise, Iris365, or integrations changed.
