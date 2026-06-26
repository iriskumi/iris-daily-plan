# Queue Calm Pass Notes

## What Was Simplified

- Filters are collapsed by default behind a small `Filters` button.
- The Filters button shows active count when filters are applied.
- Reset filters only appears when filters are active.
- Block cards now show fewer actions by default:
  - Start
  - Done
  - Skip
  - More
- Tertiary actions moved behind `More`:
  - Edit
  - Convert to 25 min
  - Move up
  - Move down
  - Subtasks/checklist
- The main next-block CTA now says `Begin next block`.
- Helper text clarifies: `Start the queue item. Timer optional.`
- `No due date` labels are hidden by default.
- Due labels only show for overdue, due today, or upcoming dated blocks.
- Secondary wording was softened:
  - `Sync & refresh`
  - `Refresh today`
  - `Open timeline focus`
  - `Focus block`

## Functionality That Stayed The Same

- Filters still work.
- Reset filters still works.
- Start, Done, Skip still work.
- Edit still works.
- Subtasks still work.
- Convert to 25 min still works.
- Move up/down still work.
- Due date editing still works.
- Block Queue remains the main planning surface.
- Today Status selectors remain unchanged.
- Daily Note remains unchanged.
- Quick Add category order remains unchanged.
- Full check-in remains collapsed.
- Timeline View remains on the Plan tab.
- Pomodoro, Focus Garden, Evening Summary, Notion export, and integrations remain untouched.

## What Should Wait Until Phase 4

- Grouping by priority, area, project, due date, or status.
- Advanced sorting controls.
- Saved filter presets.
- Drag-and-drop reordering.
- Automatic timer integration with `Begin next block`.
- More complex recommendation explanations.

## Known Limitations

- Filter open/collapsed state is session-only React state and resets on page refresh.
- `Begin next block` still marks the queue block as in progress only; it does not start Pomodoro yet.
- `More` opens the full details area, so edit and subtasks share one expanded panel.
- Move up/down are still buttons rather than drag-and-drop.
