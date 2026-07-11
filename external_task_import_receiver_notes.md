# External Task Import Receiver

## What changed

- Added URL/deep-link task import support for Iris Job Search.
- Daily Hub now watches for:

```text
?importTask={base64urlEncodedPayload}
```

- The import payload is decoded and validated before anything is created.
- A preview modal appears first, so imported tasks are never silently added.
- The preview supports editing title, estimated minutes, and context.
- The user can import to Task Inbox, import and add to Today, or cancel.

## Payload supported

```ts
{
  schemaVersion: 1,
  type: "task-import",
  sourceApp: "iris-job-search",
  sourceImportId: string,
  task: {
    title: string,
    estimatedMinutes?: number,
    context?: "work" | "life" | "study" | null,
    sourceUrl?: string,
    notes?: string,
    externalCategory?: string,
    applicationId?: string,
    company?: string,
    jobTitle?: string
  }
}
```

## Duplicate handling

- Duplicate detection uses `sourceApp + sourceImportId`.
- Duplicate imports show: `This task is already in Daily Hub.`
- The user can open the existing task or add the existing task to Today.
- Duplicate imports do not create another Task Inbox item.

## Storage behavior

- Imported tasks are created through the taskStore helper flow.
- The visible Task Inbox task is still saved into the existing `iris-tasks` storage, then mirrored into `iris-task-store`.
- No parallel imported-task array was added.
- Existing localStorage keys were not renamed or deleted.

## Today Queue behavior

- `Import and add to Today` creates or reuses the canonical task, then adds a matching Day Block to Today’s Queue.
- The queue block preserves the canonical task id through `sourceTaskId` / `unifiedTaskId`.

## Safety

- Unsupported schema versions, wrong types, missing titles, oversized payloads, and malformed payloads are rejected.
- The URL import parameter is removed after import, duplicate handling, cancel, or close.
- The receiver intentionally does not accept resumes, cover letters, full JD text, tokens, secrets, or email data.
