# ActiveSession Minimal Layer Notes

## Purpose
ActiveSession is a lightweight visibility layer for the currently active main session:
- what am I doing now?
- where should I return to?

It is not a completed record and does not update progress, stats, English reps, movement minutes, Notion, or Obsidian exports.

## Added
- `src/activeSessionStore.ts`
- Today mini banner showing the current active session.
- ActiveSession writes from retained entry points:
  - Today Start Panel -> Study
  - Today Start Panel -> English
  - Study Timer
  - English Listening Draw
  - Block Queue -> Study Session
  - Today Start Panel -> Exercise movement draft
  - Exercise movement save

## Storage
- New localStorage key: `iris-active-session`

## Clear behavior
- Completing a Study Session clears ActiveSession.
- Abandoning/cancelling a Study Session clears ActiveSession.
- Saving movement logs clears ActiveSession after the existing ExerciseLog write.
- Clicking Start Exercise from Today does not create a completed ExerciseLog entry. It only opens Exercise and marks a lightweight movement draft ActiveSession.
- Today Done only reads saved/completed StudySessionRecord and ExerciseLog history.

## Explicitly not included
- Pomodoro
- Focus Garden
- Quick Start
- Proof Vault
- Rescue timer
- Legacy timeline focus

## Not changed
- StudySessionRecord schema
- ExerciseLog schema
- Notion export
- Obsidian export
- English Output Journey counting
- Existing completed session logic
- Existing localStorage keys

## Manual QA
1. Start Study from Today Start Panel.
2. Confirm it opens Study with a 25-minute Study session active.
3. Return to Today and confirm the active banner appears.
4. Click Open session and confirm it opens Study.
5. Click Start English from Today and confirm Study opens around English Listening Draw / English Output.
6. Start English Listening Draw as a Study Session and confirm the banner appears.
7. Start a Block Queue Study Session and confirm the banner appears.
8. Refresh the browser and confirm the banner restores from `iris-active-session`.
9. Complete or abandon the Study session and confirm the banner clears.
10. Click Start Exercise from Today and confirm it opens Exercise without adding Today Done movement minutes.
11. Save an Exercise movement log and confirm it clears the active banner and then appears in Today Done.
12. Confirm Today Done only updates from existing completed/saved records.
