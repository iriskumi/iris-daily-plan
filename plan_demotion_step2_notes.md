# Plan Demotion Step 2 Notes

## What changed

- Added `fullCommandHubMode` to persisted app settings.
- Default is `false`, so compact mode is the default.
- In compact mode:
  - Plan is hidden from the permanent top-level navigation.
  - Today, Study, and Tasks remain top-level.
  - Today shows a collapsed section:
    - Label: `Generate today's plan`
    - Subtitle: `Optional schedule view for structured days`
  - Expanding that section shows the existing Block Queue and Daily Plan generation/view UI.
- In Full Command Hub mode:
  - Plan returns to the top-level nav.
  - The Today-embedded Plan panel is hidden.
  - Plan behavior uses the same existing `DailyPlanView` and `BlockQueueView` path as before.
- Added a Settings toggle:
  - `Full Command Hub mode`
  - `Show Plan as a top-level tab for work/structured days.`

## Data behavior

- This is display/navigation only.
- `plansByDate` and `GeneratedPlan` behavior are unchanged.
- Plan generation logic is unchanged.
- Notion export behavior is unchanged.
- No taskStore migration is triggered by toggling the setting.
- No Plan time blocks are converted to taskStore in this step.

## Future TODO

- Plan-generated blocks should eventually write to taskStore with `source: 'plan-generated'`.
- That conversion was intentionally not implemented in Step 2.

## Manual QA

1. Default mode: Plan is not top-level.
2. Today has collapsed `Generate today's plan` entry.
3. Expanding it still allows generating/accessing Plan.
4. Toggle Full Command Hub mode on.
5. Plan returns to top nav.
6. Toggle off.
7. Plan demotes again.
8. Today / Study / Tasks still work.
9. Notion export from Plan still works if tested.
10. No localStorage task migration is triggered by toggling this setting.
