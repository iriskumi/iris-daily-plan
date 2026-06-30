# Coursera AI Pathway Notes

## Added project

- Added a high-priority Study project for the She Plus Tech x Coursera AI Scholarship.
- Scholarship access expiry date:
  - `2026-09-23`
- The Study tab now surfaces:
  - days remaining
  - weekly activity status
  - 7-day inactivity warning
  - 10-day stronger warning
  - approaching-14-day critical warning
- Activity is based on completed Study sessions in the `Coursera AI Pathway` category.

## Added Study category

- New category:
  - `Coursera AI Pathway`
- It appears near `AI Coding`, `SQL / Excel`, and `Job / Career`.

## Added templates

- `Coursera lesson block`
- `Coursera quiz / assignment block`
- `Coursera NotebookLM review`
- `Coursera portfolio connection`
- `Coursera weekly checkpoint`

## Added course guidance

Priority course guidance shown in Study tab:

1. Google AI Essentials
2. Vanderbilt Generative AI Automation
3. Build Powerful AI Agents with OpenAI Tools
4. Google Cloud Generative AI Leader

This is displayed as guidance only, not a forced plan.

## Review and Notion behavior

- Completed Coursera sessions appear in Study Review because they use the existing Study session records.
- Markdown export includes Coursera sessions and category breakdown.
- Notion Study Daily Log payload includes Coursera in category breakdown content.
- The Notion route will fill optional `Coursera Minutes` if that property exists.
- Existing Notion push behavior remains unchanged for other categories.

## Safety notes

- Study timer behavior was not changed.
- taskStore writes continue through the existing Study session flow.
- Today / Plan / Tasks were not changed.
- Existing localStorage keys and existing Study templates were preserved.

## Manual QA

1. Open Study tab and confirm the scholarship banner is near the top.
2. Confirm days remaining counts down to `2026-09-23`.
3. Confirm `Coursera AI Pathway` appears in the Study Task Picker.
4. Start and complete a Coursera Study session.
5. Confirm Study Review shows the completed session.
6. Confirm Markdown export includes the Coursera session and category.
7. Confirm Notion Study Daily Log push still works.
8. Confirm Today / Plan / Tasks still open.
