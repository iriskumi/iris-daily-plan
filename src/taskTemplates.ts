import type { RecommendedWindow, TaskArea, TaskEnergy, TaskMode, TaskTemplate } from './types'

export const TASK_TEMPLATE_GROUPS = [
  'English Output',
  'AI / Cyber Learning',
  'Project / Vibe Coding',
  'Language Bank',
  'Evening Quiet Input',
  'Notes / Review',
  'Life Reset',
  'Job / Admin',
]

function template(
  id: string,
  group: string,
  title: string,
  area: TaskArea,
  mode: TaskMode,
  energy: TaskEnergy,
  estimatedMinutes: number,
  recommendedWindow: RecommendedWindow,
  outputLevel: TaskTemplate['outputLevel'],
  defaultBlockType: string,
  firstTinyAction: string,
  description: string,
  tags: string[],
): TaskTemplate {
  return {
    id,
    group,
    title,
    area,
    mode,
    energy,
    estimatedMinutes,
    recommendedWindow,
    outputLevel,
    defaultBlockType,
    firstTinyAction,
    description,
    tags,
  }
}

export const DEFAULT_TASK_TEMPLATES: TaskTemplate[] = [
  template('shadowing-clip', 'English Output', 'Shadowing: 2-3 min clip', 'English', 'Focus', 'Medium', 60, 'daytime', 'high', 'Shadowing block', 'Open one 2-3 minute clip and listen once without pausing.', 'Pronunciation, rhythm, stress, and reaction speed.', ['English', 'shadowing', 'speaking', 'output']),
  template('shadowing-mini', 'English Output', 'Shadowing mini block', 'English', 'Light', 'Low', 15, 'daytime', 'high', 'Shadowing block', 'Play 30 seconds of audio and shadow only 3 sentences.', 'Low-energy version of shadowing.', ['English', 'shadowing', 'light']),
  template('oral-summary', 'English Output', 'Oral summary', 'English', 'Focus', 'Medium', 15, 'daytime', 'high', 'Technical retelling block', 'Answer out loud: What was the main idea?', 'Turn input into spoken English.', ['English', 'speaking', 'summary']),
  template('technical-retelling', 'English Output', 'Technical retelling', 'English', 'Focus', 'Medium', 30, 'daytime', 'high', 'Technical retelling block', 'Answer out loud: What did I learn and why does it matter?', 'Explain technical knowledge in your own words.', ['English', 'technical English', 'speaking']),
  template('ai-cyber-course', 'AI / Cyber Learning', 'AI / IT / Cyber course block', 'Cyber', 'Focus', 'Medium', 90, 'daytime', 'mixed', 'Course learning block', 'Open the course page and preview the title plus 5 key terms.', 'Watch course content, write short summaries, and build glossary.', ['Cyber', 'AI', 'course', 'glossary']),
  template('course-glossary-preview', 'AI / Cyber Learning', 'Course glossary preview', 'Cyber', 'Light', 'Low', 15, 'daytime', 'low', 'Course learning block', 'Open the glossary and review 8 terms only.', 'Prepare before watching a course or class.', ['Cyber', 'glossary', 'low energy']),
  template('ai-news-learning', 'AI / Cyber Learning', 'AI tool / AI news learning', 'AI', 'Light', 'Low', 25, 'daytime', 'low', 'Course learning block', 'Open the AI note, news item, or tool page and capture only 3 useful points.', 'Keep up with AI tools and workflows without overloading.', ['AI', 'tools', 'news', 'notes']),
  template('five-summary-sentences', 'AI / Cyber Learning', 'Write 5 English summary sentences', 'English', 'Focus', 'Medium', 10, 'daytime', 'high', 'Course learning block', 'Write one sentence starting with "The key idea is..."', 'Convert course input into English output.', ['English', 'course', 'summary']),
  template('project-coding-block', 'Project / Vibe Coding', 'Project / Coding block', 'Vibe Coding', 'Focus', 'Medium', 90, 'daytime', 'high', 'Project / Coding block', 'Write one English sentence: Today I will fix/build/test...', 'Build or improve one real project.', ['Vibe Coding', 'project', 'coding']),
  template('small-code-ui-fix', 'Project / Vibe Coding', 'Small code/UI fix', 'Vibe Coding', 'Focus', 'Medium', 25, 'daytime', 'high', 'Project / Coding block', 'Open the project folder and identify the next smallest code/UI change.', 'Make one small visible improvement.', ['Vibe Coding', 'UI', 'bugfix']),
  template('debug-ai-english', 'Project / Vibe Coding', 'Debug with AI in English', 'Vibe Coding', 'Focus', 'Medium', 20, 'daytime', 'high', 'Project / Coding block', 'Copy the exact error and ask one clear English debugging question.', 'Practise technical English while debugging.', ['Vibe Coding', 'debugging', 'English']),
  template('english-progress-log', 'Project / Vibe Coding', 'English progress log', 'English', 'Light', 'Low', 15, 'daytime', 'medium', 'Project / Coding block', 'Write: Today I changed..., The problem was..., Next I will...', 'Record what changed in a project.', ['English', 'project log', 'writing']),
  template('chunk-bank', 'Language Bank', 'Chunk Bank', 'English', 'Light', 'Low', 30, 'daytime', 'medium', 'Chunk bank block', 'Collect 5 useful chunks from today’s material.', 'Save native-like technical, workplace, and explanation phrases.', ['English', 'chunks', 'expression bank']),
  template('technical-chunks', 'Language Bank', 'Technical chunks', 'English', 'Light', 'Low', 15, 'daytime', 'low', 'Chunk bank block', 'Find 5 phrases like "This reduces the risk of..." or "This allows the system to..."', 'Collect reusable technical explanation phrases.', ['English', 'technical chunks']),
  template('workplace-chunks', 'Language Bank', 'Workplace chunks', 'English', 'Light', 'Low', 15, 'daytime', 'low', 'Chunk bank block', 'Find 5 phrases useful for emails, meetings, or clarification.', 'Build Australian workplace expression bank.', ['English', 'workplace', 'AU']),
  template('quiet-english-reading', 'Evening Quiet Input', 'Quiet English reading', 'English', 'Light', 'Low', 45, 'evening', 'low', 'Quiet reading block', 'Open one document and mark only New concept / Useful phrase.', 'Evening-friendly input without speaking.', ['English', 'reading', 'evening']),
  template('technical-doc-reading', 'Evening Quiet Input', 'Technical documentation reading', 'AI', 'Light', 'Low', 45, 'evening', 'low', 'Quiet reading block', 'Open one docs page and mark New concept / Useful phrase only.', 'Read AWS/OpenAI/Cisco/security docs quietly.', ['AI', 'Cyber', 'docs', 'evening']),
  template('course-transcript-reading', 'Evening Quiet Input', 'Course transcript reading', 'Study', 'Light', 'Low', 25, 'evening', 'low', 'Quiet reading block', 'Open the transcript and highlight 3 useful ideas only.', 'Low-noise review of course material.', ['Study', 'reading', 'transcript']),
  template('course-notes-organisation', 'Notes / Review', 'Course notes organisation', 'Study', 'Admin', 'Low', 40, 'evening', 'low', 'Notes organisation block', 'Write 3 things I learned and 1 thing I still don’t understand.', 'Organise learning into a simple review format.', ['notes', 'review', 'evening']),
  template('expression-review-5', 'Notes / Review', 'Expression Review 5', 'Expression Review', 'Light', 'Low', 10, 'evening', 'low', 'Quiet review block', 'Review 5 entries only. Do not add new entries.', 'Keep expression review light and consistent.', ['Expression Review', 'review', 'evening']),
  template('copy-expressions-notion', 'Notes / Review', 'Copy useful expressions to Notion', 'Expression Review', 'Admin', 'Low', 15, 'evening', 'low', 'Notes organisation block', 'Copy only today’s most useful 3-5 expressions.', 'Move high-value expressions into Notion.', ['Expression Review', 'Notion', 'export']),
  template('tomorrow-planning-template', 'Notes / Review', 'Tomorrow planning', 'Admin', 'Light', 'Low', 20, 'evening', 'low', 'Tomorrow planning block', 'Choose tomorrow’s main technical topic and one project task.', 'Light planning only, no overthinking.', ['planning', 'evening']),
  template('lunch-reset-template', 'Life Reset', 'Lunch + reset', 'Life reset', 'Recovery', 'Low', 60, 'any', 'low', 'Meal block', 'Eat first. No Pomodoro and no deep work.', 'Protected meal block.', ['meal', 'reset']),
  template('dinner-reset-template', 'Life Reset', 'Dinner + reset', 'Life reset', 'Recovery', 'Low', 60, 'evening', 'low', 'Meal block', 'Eat and rest. No output-heavy task.', 'Protected evening meal block.', ['meal', 'evening', 'reset']),
  template('ten-minute-reset', 'Life Reset', '10-minute reset', 'Life reset', 'Recovery', 'Low', 10, 'any', 'low', 'Reset block', 'Get water, wash face, or clear one small surface first.', 'Small reset before restarting.', ['reset', 'recovery']),
  template('wash-hair-reset', 'Life Reset', 'Wash hair reset', 'Life reset', 'Recovery', 'Low', 30, 'any', 'low', 'Reset block', 'Start with water temperature only.', 'Recovery task for low mood / stuck days.', ['reset', 'recovery', 'mood']),
  template('jd-triage', 'Job / Admin', 'JD triage', 'Job', 'Focus', 'Medium', 25, 'daytime', 'medium', 'Job block', 'Open the JD and highlight 3 requirements only.', 'Decide whether a job is worth applying for.', ['Job', 'JD', 'applications']),
  template('resume-bullet-improvement', 'Job / Admin', 'Resume bullet improvement', 'Job', 'Focus', 'Medium', 25, 'daytime', 'medium', 'Job block', 'Open one resume section and improve one bullet only.', 'Improve resume slowly without overwhelm.', ['Job', 'resume']),
  template('work-admin-email', 'Job / Admin', 'Work/admin email', 'Admin', 'Admin', 'Low', 15, 'any', 'low', 'Admin block', 'Open the draft and write only the first sentence.', 'Reply to one email or admin message.', ['Admin', 'email']),
  template('small-admin', 'Job / Admin', 'Bills / forms / small admin', 'Admin', 'Admin', 'Low', 15, 'evening', 'low', 'Admin block', 'Open the relevant page only. Do not solve everything at once.', 'Low-noise life admin.', ['Admin', 'bills', 'forms']),
]

export const QUICK_TEMPLATE_IDS = [
  'shadowing-clip',
  'ai-cyber-course',
  'project-coding-block',
  'chunk-bank',
  'quiet-english-reading',
  'expression-review-5',
  'tomorrow-planning-template',
  'ten-minute-reset',
]

export function templatesForCurrentTime(now = new Date()): TaskTemplate[] {
  const minutes = now.getHours() * 60 + now.getMinutes()
  const ids = minutes < 12 * 60
    ? ['shadowing-clip', 'ai-cyber-course', 'course-glossary-preview']
    : minutes < 17 * 60
      ? ['project-coding-block', 'small-code-ui-fix', 'technical-retelling', 'chunk-bank']
      : ['quiet-english-reading', 'technical-doc-reading', 'course-notes-organisation', 'expression-review-5', 'tomorrow-planning-template', 'ten-minute-reset']
  return ids
    .map(id => DEFAULT_TASK_TEMPLATES.find(template => template.id === id))
    .filter((template): template is TaskTemplate => Boolean(template))
}
