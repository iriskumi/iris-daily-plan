# Single Primary Focus Screen Notes

## What changed
- Today remains the only full active Study session screen with countdown, progress, pause/resume, complete, and abandon controls.
- Study no longer renders the full active timer card while a Study session is active.
- Study now shows a compact active-session banner with title, category, remaining time, a small progress bar, and a "Return to session" button.
- "Return to session" switches back to Today and scrolls toward the active session hero.
- Daily Study Target now appears directly below the Study heading / active banner so Study stays a management dashboard.

## What did not change
- Active Study session storage and localStorage keys are unchanged.
- Timer engine behavior is unchanged.
- StudySessionRecord schema is unchanged.
- Today Done, Study Review, taskStore, queue handoff, Notion export, and Obsidian export are unchanged.
- Study can still start 25 / 50 / custom sessions when no session is active.

## Manual QA
1. Start a Study session from Study.
2. Confirm Today shows the full active session hero with countdown and controls.
3. Open Study and confirm it shows only the compact active-session banner, not the full timer.
4. Click "Return to session" and confirm it opens Today without restarting the timer.
5. Pause, resume, complete, and abandon from Today.
6. Confirm completed sessions still appear in Today Done and Study Review.
