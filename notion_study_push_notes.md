# Notion Study Push Notes

## Scope

Phase S5 adds a Study Dashboard-specific push to the existing Notion Daily Logs database.

It does not replace the existing Daily Hub Notion export and does not add direct Notion push for individual Study sessions.

## Endpoint

- Frontend service: `pushStudyDailyLogToNotion`
- Vercel route: `/api/notion/push-study-daily-log`

## Environment

Uses the existing Notion integration environment variables:

- `NOTION_API_KEY`
- `NOTION_DATABASE_ID`

## Duplicate Safety

The route queries the Daily Logs database by the `Date` property.

- If a page exists for the date, it updates that page.
- If no page exists, it creates one.
- If the database cannot be queried safely by `Date`, the route returns an error instead of creating a possible duplicate.

## Property Mapping

Required / core mappings when compatible properties exist:

- `Date` -> Study log date
- `Planner Source` -> `study-dashboard`
- `Focus Minutes` -> completed Study minutes
- `Study Minutes` -> completed Study minutes
- `AI Minutes` -> AI Coding minutes
- `Admin Minutes` -> Admin / Life minutes
- `Carry Over` -> Study Review carry-over
- `Summary` -> generated Markdown summary

Optional mappings:

- `English Minutes`
- `Japanese Minutes`
- `Cyber Minutes`
- `SQL/Data Minutes`
- `Job/Career Minutes`
- `Review Minutes`
- `Session Count`
- `Top Category`
- `Obsidian Notes`
- `Actual Done`
- `Tomorrow Next Step`

Missing optional properties are skipped. The same information is still included in the page content and Summary.

## Page Content

The pushed page content includes:

- Study Sessions
- Category Breakdown
- Actual Done
- Carry Over
- Tomorrow’s Smallest Next Step
- Markdown Summary

Only completed sessions are counted in completed minutes and category totals.
