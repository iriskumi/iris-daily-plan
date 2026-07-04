# Cross-Origin Expression Review Hub Import Notes

## What Changed

Daily Hub now supports Expression Review Hub imports across different deployed origins:

- Expression Review Hub: `https://iris-expression-review-hub.vercel.app/`
- Daily Hub: `https://iris-daily-plan.vercel.app/`

The existing same-origin localStorage queue import remains available.

## Import Methods

### 1. URL Import

Daily Hub detects this query parameter on app load:

```text
?importExpressionOutput={base64urlEncodedPayload}
```

Behavior:

- Decodes the base64url JSON payload.
- Validates it as an Expression Review Hub `english-output-rep`.
- Imports it as a completed Study session and English Output Journey reps.
- Removes the URL parameter from browser history after processing, so refresh does not re-import.
- Stores a short session notice so the Study tab can show success or error status.

### 2. Clipboard / Manual Paste Import

The Study tab now has an **Integration Inbox** card for Expression Review Hub.

It includes:

- A link to Expression Review Hub.
- The existing local queue import button.
- A textarea for pasting JSON.
- An import button for pasted JSON.

## Import Behavior

Each valid payload creates:

- A completed `StudySessionRecord`.
- An English Output Journey history item using `payload.reps`.
- A mirrored taskStore study session through the existing Study session writer.

The imported Study session uses:

- `title`: `payload.title`
- `category`: `English Output`
- `plannedMinutes`: `payload.durationMinutes`
- `actualMinutes`: `payload.durationMinutes`
- `status`: `completed`
- `source`: `expression-review-hub`
- `sourceImportId`: `payload.id`
- `noteDestination`: `payload.obsidianPath`
- `notes`: `payload.markdown`

## Duplicate Safety

Duplicate prevention uses `payload.id`.

Daily Hub checks:

- English Output Journey history `importItemId`.
- Existing Study session ID: `expression-hub-session:{payload.id}`.

If the same payload is imported again, it does not double-count reps or duplicate the Study session.

## What Stays Unchanged

- Study timer behavior.
- Existing Study sessions.
- English Output Journey manual and timer-based counting.
- taskStore schema.
- Today / Plan / Tasks.
- Notion database schema.
- Existing localStorage queue import via `importExpressionHubQueue`.
