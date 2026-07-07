# Start Panel / Today Done Simplification

## What changed

- Replaced the old visible Quick Start system on Today with one focused Start Panel.
- Today now leads with:
  - Today Note
  - Start Panel
  - Next Useful Thing
  - Today Done
- Start Study, English, and Admin create a real active Study Session using the existing Study timer storage.
- Start Exercise logs a lightweight movement entry through the existing Exercise Log.
- Start Reset saves a small Today reset record only for Today Done.
- Next Useful Thing uses the active Study Session first, then the next Block Queue item.
- Today Done summarizes completed sessions/logs only.

## What was hidden from the main flow

- Quick Start as a separate visible timer system
- Visible Effort as a separate system
- Focus Garden / Pomodoro from the main Today flow
- Proof Vault and save-proof prompts from the main Study/Today flow
- Iris365 / legacy proof tools are preserved behind the collapsed legacy panel

## Counting rule

Study minutes count only after a Study Session is completed.

Queued tasks, skipped tasks, planned blocks, and reset records do not add Study minutes.

English Output sessions count as reps when completed through the Study Session system.
English Input is counted as input minutes, not output reps.

## Data safety

No old localStorage keys were deleted.

Legacy data is preserved, including:

- Focus Garden / Pomodoro history
- Proof Vault data
- old Quick Start records
- Iris365 data

## Still to review later

- Whether Reset records should eventually sync into a broader daily log export.
- Whether Exercise quick logs should offer duration editing before saving.
- Whether Study Dashboard should expose a dedicated “started from Today” filter.
