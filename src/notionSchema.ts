export type NotionSchemaPropertyKind = 'number' | 'select-or-text' | 'text' | 'formula'

export interface NotionSchemaRequirement {
  name: string
  kind: NotionSchemaPropertyKind
}

export interface NotionSchemaIssue extends NotionSchemaRequirement {
  actualType?: string
}

export interface NotionSchemaCheckResult {
  existing: string[]
  missing: NotionSchemaIssue[]
  incompatible: NotionSchemaIssue[]
  canCreateMissing: boolean
}

export const NOTION_TIME_SCHEMA: NotionSchemaRequirement[] = [
  { name: 'Focus Minutes', kind: 'number' },
  { name: 'Vibe Coding Minutes', kind: 'number' },
  { name: 'Cyber Minutes', kind: 'number' },
  { name: 'AI Minutes', kind: 'number' },
  { name: 'English Output Minutes', kind: 'number' },
  { name: 'Expression Review Minutes', kind: 'number' },
  { name: 'Job Minutes', kind: 'number' },
  { name: 'Admin Minutes', kind: 'number' },
  { name: 'Study Minutes', kind: 'number' },
  { name: 'Recovery Minutes', kind: 'number' },
  { name: 'Completed Blocks', kind: 'number' },
  { name: 'Partial Blocks', kind: 'number' },
  { name: 'Skipped Blocks', kind: 'number' },
  { name: 'Main Focus Area', kind: 'select-or-text' },
  { name: 'Useful Output Summary', kind: 'text' },
  { name: 'Focus Hours', kind: 'formula' },
]

export function notionPropertyMatches(kind: NotionSchemaPropertyKind, actualType: string): boolean {
  if (kind === 'select-or-text') return actualType === 'select' || actualType === 'rich_text'
  if (kind === 'text') return actualType === 'rich_text'
  return kind === actualType
}

export const NOTION_SCHEMA_MANUAL_INSTRUCTIONS = [
  'Please add these properties to your Notion Daily Logs database:',
  'Number: Focus Minutes, Vibe Coding Minutes, Cyber Minutes, AI Minutes, English Output Minutes, Expression Review Minutes, Job Minutes, Admin Minutes, Study Minutes, Recovery Minutes, Completed Blocks, Partial Blocks, Skipped Blocks.',
  'Select or Text: Main Focus Area.',
  'Text: Useful Output Summary.',
  'Formula: Focus Hours = prop("Focus Minutes") / 60.',
].join('\n')
