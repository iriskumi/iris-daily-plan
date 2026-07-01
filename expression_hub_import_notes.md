# Expression Review Hub Import Notes

## What Changed

- Added Daily Hub support for the Expression Review Hub localStorage queue:
  - `iris-daily-hub-import-queue`
- Added a Study tab card: **Import from Expression Hub**.
- The card shows:
  - pending import count
  - an **Import now** button
  - last imported time when available

## Import Behavior

Daily Hub imports queue items where:

- `type` is `english-output-rep`
- `source` is `expression-review-hub`
- `importedAt` is missing

Each imported item creates:

- English Output Journey reps using the item’s `reps` value.
- A completed Study session record with:
  - title from the import item
  - category `English Output`
  - planned and actual minutes from `durationMinutes`
  - notes from `markdown`, with expression details included when available
  - note destination from `obsidianPath`
- A mirrored taskStore study session through the existing Study session writer.

## Duplicate Safety

- Import item IDs are stored in English Output Journey history as `importItemId`.
- Study session IDs are stable: `expression-hub-session:{item.id}`.
- Clicking **Import now** multiple times will not double-count reps or duplicate the Study session.
- Imported queue items are not deleted. They are marked with `importedAt`.

## Where Imported Sessions Appear

Because imports become normal completed Study sessions, they appear in:

- Study Review sessions
- English Output Journey today/week/total counts
- Daily Study Markdown export
- Notion Study Daily Log content
- taskStore session history

## Scope

- English Input is not imported.
- Notion database schema was not changed.
- Study timer behavior was not changed.
