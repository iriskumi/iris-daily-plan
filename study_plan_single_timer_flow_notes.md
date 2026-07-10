# Study / Plan Single Timer Flow

## What changed
- Removed the Expression Review Hub Integration Inbox from the Study page.
- Moved Expression Review Hub import controls to Integrations.
- Replaced Plan / Block Queue timer start buttons with `Open in Study`.
- Today Next now opens Study instead of starting a timer independently.
- Added a small handoff layer so Plan/Today can select a queue block for Study without creating a duplicate task.
- Study now shows the selected queue task above the timer and lets the user choose 25, 50, or custom duration there.
- Opening a queue block in Study does not mark the queue block in progress or done.

## Flow
1. Plan or Today chooses the next queue block.
2. `Open in Study` writes a short sessionStorage handoff.
3. Study consumes the handoff, pre-fills the selected task, and scrolls to the timer.
4. The user starts 25, 50, or custom duration in Study.
5. Completed sessions still write the existing StudySessionRecord format.

## What was not changed
- StudySessionRecord schema.
- Timer calculation and recovery logic.
- Today Done counting.
- taskStore model.
- Existing localStorage keys.
- Notion / Obsidian export behavior.
- Expression Hub import logic.
- Exercise and Media behavior.

## Manual QA
1. Open Study and confirm it starts with study content, not Expression Hub import.
2. Open Integrations and confirm Expression Review Hub import controls are available there.
3. Open Plan and confirm queue cards show `Open in Study`, not Start 25/50.
4. Click `Open in Study` from a queue block.
5. Confirm Study opens, shows the selected task, and does not auto-start the timer.
6. Start 25 or 50 minutes from Study and complete it.
7. Confirm Study Review and Today Done still update.
8. Confirm large queue tasks are not automatically marked done after one Study session.
