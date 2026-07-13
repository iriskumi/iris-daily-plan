# Iris365 Checkbox Recording Clarity Notes

## What changed
- Added helper copy beside the Iris365 foundation checklist:
  - "勾选后会保存到今天的 Iris365 记录，用来计算当天基础锚点。不会算作 Study Session。"
- The foundation card save pill now shows the latest save time when today's Iris365 entry is saved.
- Iris365 entry saves now show a small visible error if saving fails instead of failing silently.

## What did not change
- Iris365 storage keys and data shape.
- Study Session logic.
- Today Done logic.
- task/session behavior.
- Foundation score calculation.

## Manual checks
1. Open Iris365 and check one foundation anchor.
2. Confirm the `0 / 3` score updates immediately.
3. Confirm the save pill changes to `Saved HH:MM`.
4. Refresh the page and confirm the checkbox remains checked.
5. Confirm no Study Session is created.
6. Confirm Today Done does not receive a new record from checking Iris365 boxes.
