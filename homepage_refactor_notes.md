# Homepage Refactor Notes

## What changed

- The Today homepage now starts with a calmer task-oriented command centre.
- The first screen is organised around:
  - Today Status
  - Next Best Block
  - Block Queue
  - Habit Quick Add
- The main call to action is now **Start next block**.
- The homepage uses the Phase 1/2 block queue data instead of adding another planning model.
- The old Timeline View remains unchanged on the Plan tab.
- Today Status is now interactive with compact chips for Day Mode, Energy, and Main Focus.

## What moved lower or collapsed

- Low-energy rescue controls moved into a collapsible **Low-energy mode** panel.
- Start a Focus Block and Focus Garden moved into a collapsible **Focus tools** panel.
- Bills and Work reminders moved into a collapsible **Admin reminders** panel.
- Start Today / sync / carry-over moved into a collapsible **Start Today / sync** panel.
- Daily Check-in moved into a collapsible **Full check-in** panel.
- The old generated-plan Next Action card remains available as a secondary legacy action inside Focus tools.

## Interactive Today Status

The compact Today Status card supports:

- Day Mode: Full Day, Normal Day, Late Start, Rescue Day, Evening Class, Saturday Class, Work Shift, Admin Catch-Up.
- Energy: Low, Medium, High.
- Main Focus: Cyber, AI Project, English, SQL / Excel, Admin, Reading, Health.

These choices are saved into today’s block queue record in localStorage.

Behavior:

- Day Mode updates target blocks and the overview immediately.
- Energy changes the next-block suggestion.
- Low energy prefers low-input, admin, recovery, and lower-energy blocks.
- High energy can surface deep work or output blocks.
- Main Focus prioritises matching queue block areas.

## How Quick Add templates work

The new Quick Add creates queue blocks directly, not full task inbox items. This keeps the homepage fast and block-oriented.

Top-level groups:

- Cyber
- AI Project
- English
- SQL / Excel
- Admin
- Reading
- Reset

Each template creates a Day Block with:

- title
- estimated minutes
- block type
- area
- priority
- energy level
- optional project

Examples:

- Cyber assessment writing: 60 min, deep work, cyber, must.
- Codex task: 45 min, deep work, AI project, should.
- Shadowing 2-3 min clip: 45 min, output, English, should.
- SQL practice: 45 min, deep work, SQL/Data, should.
- Bills / finance check: 25 min, admin, life admin, should.
- Low-noise reading: 45 min, low input, reading, could.
- Brown noise + breathe: 5 min, recovery, health, could.

## What still needs review

- Whether **Start next block** should also start a Pomodoro session automatically, or only mark the queue block as in progress.
- Whether Quick Add blocks should optionally sync back into the Task Inbox.
- Whether the Daily Check-in panel should auto-open when no check-in exists.
- Whether completed queue minutes should be separated from Pomodoro-verified focus minutes in future stats.
- Mobile visual QA in a real browser, since sandboxed localhost checks may not connect back to the dev server.
