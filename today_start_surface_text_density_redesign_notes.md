# Today Start Surface Text Density Redesign

## What changed
- Reworked the Today start surface into a lower-text layout.
- Added an active-session-first Today state: when a session is running, Today shows one dominant current-session card and short module chips.
- Simplified the default Start Panel to three actions only: Study, English, Exercise.
- Added a compact progress strip for Study minutes, English reps, Movement minutes, and completed sessions.
- Collapsed Today Note, Today Done, and Block Queue behind short one-line chips.
- Kept Block Queue internals intact and reused the existing queue controls when expanded.

## Files changed
- `src/components/StartNowDashboard.tsx`
- `src/components/HomeCommandCentre.tsx`
- `src/App.tsx`
- `src/index.css`

## What was intentionally not changed
- No localStorage keys were renamed, deleted, or migrated.
- No completion/statistics rules changed.
- No Study, Exercise, Notion, Obsidian, Media, Plan, Integrations, or Settings logic changed.
- Quick Start, Focus Garden, Pomodoro, Proof Vault, Start Admin, and Start Reset were not reintroduced.

## Manual QA
1. Open Today with no active session and confirm Start is the dominant section.
2. Confirm only Study, English, and Exercise actions appear in the Start Panel.
3. Expand Note, Done, and Queue chips one at a time.
4. Confirm Queue still allows the existing block queue actions.
5. Start a Study session and return to Today.
6. Confirm the active-session card replaces the Start Panel.
7. Complete/abandon the session and confirm Today returns to the default start surface.
