# Navigation Final Structure Notes

## Top-level navigation
The main app navigation is now exactly:

- Today
- Study
- Plan
- Exercise
- Media
- Integrations

Settings remains accessible through the header gear icon.

## Where previous top-level areas moved
- Tasks moved into `Plan` as an expandable `Task inbox / templates` section.
- Iris365 Momentum moved into `Today` as a compact card using the existing `iris-365-log` data.
- The older Iris365 / Proof / Before I Spiral surface is preserved on `Today` inside `Proof / Comeback tools`.
- Sessions history remains stored and available through existing session data, but is no longer a top-level tab.

## Preserved workflows
- Study Dashboard remains top-level under `Study`.
- Plan generation, generated plan, block queue, Notion push, and Markdown export remain under `Plan`.
- Media log remains top-level under `Media`.
- Exercise log remains top-level under `Exercise`.
- Calendar / Gmail / Gemini / Notion integration UI remains top-level under `Integrations`.

No localStorage keys were renamed or deleted.
