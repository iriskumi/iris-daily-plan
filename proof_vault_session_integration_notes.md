# Proof Vault Session Integration Notes

## Added
- Study sessions can now create Proof Vault entries without starting from a blank form.
- Completed proof-worthy sessions show a quiet "Save this as proof?" prompt.
- Daily Study Log session rows show "Save as proof" or "Proof saved".
- Daily Study Log now shows proofs created today.
- Markdown export includes a `Proof Created Today` section.

## Proof-worthy by default
- English Output
- Coursera AI Pathway
- AI Coding
- Job / Career
- Cyber

Other categories can still be saved as proof if the session has notes, a resource, or a note destination.

## Duplicate safety
- Proof entries from Study sessions store `source: "study-session"` and `sourceSessionId`.
- `addIris365ProofItem` refuses to create a second proof item with the same `sourceSessionId`.

## Storage
- Existing Proof Vault data remains under `iris-365`.
- Existing manual proof items normalise to `source: "manual"`.
- No Study session keys were removed or migrated.

## Not changed
- Study timer behavior
- Study session records
- English Output Journey counting
- taskStore writing
- Today / Plan / Tasks behavior
- Notion database schema
- Existing localStorage keys

## Manual test
1. Complete an English Output, Coursera AI Pathway, AI Coding, Job / Career, or Cyber Study session.
2. Confirm a small "Save this as proof?" prompt appears.
3. Click "Save proof" and confirm Daily Study Log shows the proof under "Proof Created Today".
4. Confirm the same session row shows "Proof saved".
5. Try saving the same session again and confirm no duplicate proof is created.
6. Complete a non-proof category session and confirm it is not aggressively prompted unless it has notes/resource output.
7. Copy daily study markdown and confirm it includes `## Proof Created Today`.
8. Confirm Notion Study Daily Log push still uses the existing markdown flow.
