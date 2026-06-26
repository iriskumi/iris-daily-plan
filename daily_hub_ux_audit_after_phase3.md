# Daily Hub UX Audit After Phase 3

## Scope

This audit reviews the current UX after the homepage refactor, Block Queue, Phase 3 filters/subtasks/editing, Quick Add updates, and Daily Note update.

No implementation changes are included in this report.

## 1. Is the Homepage Still Visually Overwhelming?

Partly, but much less than before.

The homepage now has a clearer top-down flow:

1. Daily Note
2. Today Status
3. Next Best Block
4. Block Queue
5. Habit Blocks
6. Collapsed secondary tools

This is a major improvement over the earlier feature-showcase homepage. The first screen now feels more like a command centre.

Remaining pressure points:

- Today Status is useful but dense. Day Mode, Energy, Main Focus, and four stats all live in one card.
- Block Queue cards show many controls: Start, Done, Skip, Edit, Subtasks, Move up, Move down.
- Phase 3 filters are visible by default, which adds functional power but also visual weight.
- Habit Blocks now has 10 categories. The ordering is good, but the category row can still feel like a lot on small screens.

Recommendation before Phase 4:

- Keep the homepage structure, but consider making filters collapsible behind a small “Filter” button.
- Consider hiding Move up/down behind a small reorder mode or icon-only controls.
- Keep Habit Blocks, but make sure the category row scrolls calmly on mobile.

## 2. Duplicate Actions or Confusing Entry Points

There are still duplicate “start” concepts, but they are better contained.

Current start/action entry points:

- Start next block
- Start on individual Block Queue cards
- Low-energy mode: Give me the smallest useful step
- Focus tools: Start a Focus Block
- Legacy plan next action: Start legacy focus
- Start Today / sync
- Generate plan through full check-in / Plan / Integrations

The main CTA is correctly established as **Start next block**. The other actions are secondary because they are collapsed, which helps a lot.

Potential confusion:

- “Start next block” currently marks a queue block as in progress, but it does not obviously start a Pomodoro/focus timer.
- “Start” on block cards and “Start next block” sound identical but may not feel meaningfully different.
- “Start Today / sync” still sounds like a primary daily action, even though it is now lower priority.
- “Focus tools” can still feel like an alternate workflow rather than support for the queue.

Recommendation before Phase 4:

- Decide whether “Start next block” should also open/start a focus timer or remain a queue status action.
- Rename secondary “Start Today / sync” to something like “Refresh today” or “Sync & refresh plan” to reduce conflict.
- Rename “Start legacy focus” to something quieter, or keep it hidden unless needed.

## 3. Does the App Clearly Answer “What Is My Next Useful Step?”

Mostly yes.

The Next Best Block card is now the strongest answer. It shows:

- block title
- reason
- area/project/priority/minutes
- Start next block CTA
- 25-min, Skip, Change block options

This is the right centre of gravity.

Remaining ambiguity:

- The reason text is helpful but generic. It explains priority, energy, due date, or focus, but may not always explain the exact “why now” clearly.
- If the queue is empty, the app points to Quick Add, but the transition could be more explicit.
- If filters hide the suggested block, the relationship between Next Best Block and visible queue may feel odd.

Recommendation before Phase 4:

- Keep Next Best Block as the primary answer.
- Add a small empty-queue microcopy later: “Add one habit block below to create your next step.”
- If filters are active, consider showing whether the next block is hidden by filters.

## 4. Are Quick Add Categories Useful and Not Too Many?

The categories are useful and better aligned with real habits now.

Current order is strong:

1. English Output
2. English Input
3. Japanese
4. AI Coding
5. SQL / Excel
6. Job / Career
7. Review / NotebookLM
8. Admin / Life
9. Cyber
10. Reset

This order feels emotionally smarter than leading with Cyber. It starts with daily identity and language habits, then practical skill-building, then career/admin/cyber/recovery.

Concern:

- Ten categories is near the upper limit for a homepage row.
- The templates are specific and useful, but each template card includes title, minutes, type, energy, notes, and optional labels. This can become visually heavy.

Recommendation before Phase 4:

- Keep all 10 categories for now.
- Do not add more top-level categories soon.
- If the row feels crowded on mobile, use horizontal scroll rather than more wrapping.
- Consider showing only title + minutes/type by default, and reveal notes on hover/expand later.

## 5. Is Block Queue Easy to Use?

The Block Queue is useful, but it is now approaching “power user” density.

Strengths:

- The queue is task-oriented, not timetable-oriented.
- Blocks show status, priority, area, estimate, due date, and subtasks.
- Core actions are available without leaving the card.
- Manual order is preserved.
- Inline editing and subtasks reduce friction.

Pain points:

- Every card has many visible controls.
- Filters, edit, subtasks, and queue actions all compete for attention.
- “Done” and “Complete” language is inconsistent across some areas.
- Due labels are useful, but “No due date” on every card may add noise.

Recommendation before Phase 4:

- Keep Block Queue as the main planning surface.
- Simplify visible card actions before adding grouping/sorting:
  - Primary: Start
  - Secondary: Done, Skip
  - Tertiary/icon: Edit, Subtasks, Move
- Consider hiding “No due date” unless the user filters by due date or edits the block.

## 6. Are Filters/Subtasks Helpful or Too Much?

They are helpful, but filters may be too visible by default.

Filters:

- Good for longer queues and backlog-heavy days.
- Useful categories: priority, status, area, due.
- They add visual overhead when the queue is short.

Subtasks:

- Very useful for blocks like Shadowing, CV, STAR answer, and portfolio write-up.
- The collapsed progress is helpful.
- The expanded checklist is practical.
- The “all subtasks done” suggestion is the right behavior because it does not force completion.

Recommendation before Phase 4:

- Keep subtasks.
- Consider collapsing filters by default.
- Keep Reset filters visible only when filters are active.
- Do not add grouping/sorting until filter visual weight is reduced.

## 7. What Should Be Simplified Before Adding Phase 4?

Priority simplifications:

1. Make filters collapsible or lighter.
2. Reduce visible actions on each queue card.
3. Clarify what “Start next block” does.
4. Decide whether queue-start should connect to Pomodoro/focus sessions.
5. Keep due labels quieter, especially “No due date.”
6. Reduce duplicated “start” language in secondary collapsed sections.
7. Consider moving full compact edit behind a single Edit panel trigger rather than showing edit capability as equal weight to Start/Done.

Phase 4 should wait until these are resolved. Grouping/sorting would otherwise add another layer of controls on top of an already dense queue.

## 8. What Should Stay Untouched?

Keep these as-is for now:

- The overall homepage structure.
- The Daily Note direction and visual treatment.
- The chosen Quick Add category order.
- English Output / English Input split.
- Japanese as its own category.
- Job / Career as its own category.
- Cyber moved later in the list.
- Block Queue as the main planning surface.
- Full check-in as a collapsed secondary section.
- Timeline View staying on the Plan tab.
- Existing integrations: Gemini, Calendar, Gmail, Notion.
- Evening Summary, Actual Done / Notes, Pomodoro, Focus Garden, Notion export.
- LocalStorage data model unless a real migration need appears.

## Recommended Next Step

Before Phase 4, do a small “Queue Calm Pass”:

- Collapse filters.
- Simplify block card actions.
- Clarify Start next block behavior.
- Make due labels quieter.
- Reduce secondary start/action wording.

Then Phase 4 grouping/sorting will have a cleaner place to land.
