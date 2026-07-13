import { useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, Leaf, Plus, ShieldCheck, TrendingUp } from 'lucide-react'
import { getLocalDateKey } from '../focus'
import DailyRhythmLog from './DailyRhythmLog'
import {
  addIris365DopamineSwapLog,
  addIris365ProofItem,
  calculateCurrentDayNumber,
  calculateDaysRemaining,
  calculateFoundationScore,
  calculateFoundationStatus,
  foundationStatusForScore,
  calculateIris365Stats,
  determineCurrentPhase,
  emptyIris365MonthlyReview,
  emptyIris365WeeklyReview,
  getIris365MonthId,
  getIris365WeekEntries,
  getIris365WeekStart,
  getIris365DopamineWeekStats,
  IRIS_365_HIGH_STIMULUS_PATTERNS,
  IRIS_365_PROOF_CATEGORIES,
  IRIS_365_START_DATE,
  iris365ProgressPercent,
  isBeforeIris365Start,
  isIris365WeeklyReviewDay,
  loadIris365Entry,
  loadIris365Store,
  recentIris365Entries,
  saveIris365Entry,
  saveIris365MonthlyReview,
  saveIris365SwapLibraryItem,
  saveIris365WeeklyReview,
  updateIris365DopamineSwapLog,
} from '../iris365Storage'
import { getIris365DailyAnchorSync } from '../iris365Sync'
import type {
  Iris365DopamineFeedbackReason,
  Iris365DopamineOutcome,
  Iris365DopamineState,
  Iris365DopamineSuggestionType,
  Iris365DopamineSwapLibraryItem,
  Iris365DopamineSwapLog,
  Iris365DopamineUrge,
  Iris365Entry,
  Iris365DayType,
  Iris365HighStimulusPatternKey,
  Iris365HighStimulusPatternStatus,
  Iris365MonthlyReview,
  Iris365ProofCategory,
  Iris365ProofKey,
  Iris365SkillKey,
  Iris365WeeklyReview,
} from '../iris365Types'

const FOUNDATION_FIELDS: Array<{
  key: 'sleepRhythmProtected' | 'bodyMoved' | 'oneRealThingDone'
  proofKey: Iris365ProofKey
  label: string
  hint: string
}> = [
  { key: 'sleepRhythmProtected', proofKey: 'body', label: 'Sleep rhythm protected', hint: 'Protect bedtime, wake rhythm, or recovery window.' },
  { key: 'bodyMoved', proofKey: 'body', label: 'Body moved', hint: 'Walk, stretch, gym, chores, or a five-minute reset.' },
  { key: 'oneRealThingDone', proofKey: 'realWorld', label: 'One real thing done', hint: 'A practical action that makes life, work, study, or health more real.' },
]

const DAILY_PROOF_ORDER: Iris365ProofKey[] = ['body', 'english', 'realWorld']

const DAY_TYPE_OPTIONS: Array<{ value: Iris365DayType; label: string; hint: string }> = [
  { value: 'normal', label: 'Normal', hint: 'steady day' },
  { value: 'drift', label: 'Drift', hint: 'notice, reduce friction' },
  { value: 'recovery', label: 'Recovery', hint: 'minimum anchors count' },
  { value: 'push', label: 'Push', hint: 'extra output if stable' },
]

const ENERGY_OPTIONS: Array<{ value: 'low' | 'medium' | 'high'; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

const SKILL_LABELS: Record<Iris365SkillKey | 'foundation', string> = {
  foundation: 'Foundation',
  english: 'English fluency',
  aiAutomation: 'AI / automation',
  data: 'Data / SQL',
  cyber: 'Cyber awareness',
  japanese: 'Japanese employability',
  career: 'Career positioning',
  lifeSystem: 'Life system',
}

const SKILL_ROADMAP: Array<{ key: Iris365SkillKey; title: string; why: string; tiny: string; standard: string; output: string }> = [
  { key: 'english', title: 'English fluency', why: 'Speak and write in a way that makes study, work, interviews, and relationships easier in Australia.', tiny: 'One 5-minute active output rep.', standard: '25 minutes speaking, shadowing, writing, or oral summary.', output: 'Reusable expressions, recordings, interview answers, workplace scripts.' },
  { key: 'japanese', title: 'Japanese employability', why: 'Keep Japanese available as a work advantage, not a fading background skill.', tiny: 'Read or produce one useful workplace phrase.', standard: '25 minutes Japanese admin/customer-service/workplace practice.', output: 'Bilingual service notes, resume bullets, Japanese-English examples.' },
  { key: 'aiAutomation', title: 'AI / automation', why: 'Build practical workflows that make you useful in admin, education, data, and operations contexts.', tiny: 'Capture one automation idea.', standard: 'One small implementation or workflow note.', output: 'Daily Hub improvements, scripts, AI workflow case notes.' },
  { key: 'data', title: 'Data / SQL', why: 'Keep a clean technical foundation for admin, reporting, automation, and AI-adjacent roles.', tiny: 'One SQL/Excel concept or query.', standard: '25 minutes SQL, Excel, dashboard, or data cleaning practice.', output: 'Queries, mini dashboards, data notes, examples.' },
  { key: 'cyber', title: 'Cyber / digital awareness', why: 'Build confidence around security, privacy, systems, and TAFE/career readiness.', tiny: 'One concept, term, or assessment step.', standard: '25 minutes cyber learning or assessment work.', output: 'Cyber notes, risk examples, assessment progress.' },
  { key: 'career', title: 'Career positioning', why: 'Turn your learning into visible career assets for Australia.', tiny: 'One resume, LinkedIn, application, or role research step.', standard: 'One tailored application or portfolio/career note.', output: 'CV bullets, LinkedIn updates, application drafts, interview stories.' },
  { key: 'lifeSystem', title: 'Health, routine, emotional stability', why: 'The base layer that makes all other skills possible.', tiny: 'Sleep anchor, movement, food, shower, one admin edge.', standard: 'A repeatable day shape with body and recovery protected.', output: 'Stable routines, lower stimulation, better recovery, fewer spirals.' },
]

const GROWTH_FIELDS: Array<{
  key: 'englishOutput' | 'shadowing' | 'cyberAiProject' | 'jobApplication' | 'workPrep' | 'studyCoursework' | 'lifeAdmin'
  label: string
  hint: string
}> = [
  { key: 'englishOutput', label: 'English output', hint: 'Speaking or original writing, not passive input.' },
  { key: 'shadowing', label: 'Shadowing', hint: 'A small rhythm and pronunciation proof.' },
  { key: 'cyberAiProject', label: 'Cyber / AI project', hint: 'Portfolio, automation, cyber, or AI workflow progress.' },
  { key: 'jobApplication', label: 'Job application', hint: 'Apply, tailor, follow up, or improve a job asset.' },
  { key: 'workPrep', label: 'Work prep', hint: 'Workplace readiness, admin practice, or shift preparation.' },
  { key: 'studyCoursework', label: 'Study / coursework', hint: 'Holmesglen, Coursera, SQL, English, or structured learning.' },
  { key: 'lifeAdmin', label: 'Life admin', hint: 'Bills, documents, appointments, cleaning, or planning.' },
]

const HIGH_STIMULUS_LABELS: Record<Iris365HighStimulusPatternKey, string> = {
  shortDramas: 'Short dramas',
  webNovels: 'Web novels',
  xiaohongshuSocialMedia: 'Xiaohongshu / social media',
  shopping: 'Shopping',
  mobileGames: 'Mobile games',
  other: 'Other',
}

const STIMULUS_STATUS_LABELS: Record<Iris365HighStimulusPatternStatus, string> = {
  'not-used': 'Not used',
  controlled: 'Controlled',
  overused: 'Overused',
}

const FOUNDATION_STATS: Array<[keyof ReturnType<typeof calculateIris365Stats>, string]> = [
  ['totalRecordedDays', 'Days recorded'],
  ['validDays', 'Valid days'],
  ['foundationDays', 'Foundation days'],
  ['sleepRhythmProtectedDays', 'Sleep rhythm'],
  ['movementDays', 'Movement'],
  ['realThingDays', 'Real thing'],
  ['currentStreak', 'Current valid streak'],
  ['bestStreak', 'Best valid streak'],
]

const GROWTH_STATS: Array<[keyof ReturnType<typeof calculateIris365Stats>, string]> = [
  ['englishOutputDays', 'English output'],
  ['shadowingDays', 'Shadowing'],
  ['cyberAiProjectDays', 'Cyber / AI'],
  ['jobApplicationDays', 'Job application'],
  ['studyCourseworkDays', 'Study'],
  ['workPrepDays', 'Work prep'],
]

const WEEKLY_REVIEW_FIELDS: Array<[keyof Omit<Iris365WeeklyReview, 'weekStartDate' | 'weekEndDate' | 'scores' | 'updatedAt'>, string]> = [
  ['proofThisWeek', 'What proof did I leave this week?'],
  ['attentionDrain', 'What drained my attention the most?'],
  ['bestReturnHabit', 'Which habit gave me the best return?'],
  ['makeEasierNextWeek', 'What should I make easier next week?'],
  ['nextWeekPriority', 'What is next week’s one priority?'],
]

const PROOF_QUICK_CHIPS: Array<{ label: string; category: Iris365ProofCategory; description: string }> = [
  { label: 'Did one real thing', category: 'Personal insight', description: '一句话就够：这说明我没有原地踏步。' },
  { label: 'Captured one English sentence', category: 'English output', description: 'Small evidence still counts.' },
  { label: 'Avoided a rabbit hole', category: 'Emotional regulation', description: '先别开新坑，也是一种进步。' },
  { label: 'Finished a tiny study block', category: 'Cyber / TAFE', description: '不是没进步，是进步太碎。' },
  { label: 'Saved a work/resume note', category: 'Work experience', description: 'A small career asset got captured.' },
  { label: 'Protected sleep', category: 'Health / routine', description: 'Protect tomorrow counts.' },
  { label: 'Moved my body', category: 'Health / routine', description: 'Body moved. The system got a little support.' },
]

const DOPAMINE_URGES: Array<{ value: Iris365DopamineUrge; label: string }> = [
  { value: 'ai-short-dramas', label: 'AI short dramas' },
  { value: 'chinese-web-novels', label: 'Chinese web novels' },
  { value: 'xiaohongshu-scrolling', label: 'Xiaohongshu / scrolling' },
  { value: 'shopping-price-checking', label: 'Shopping / price checking' },
  { value: 'romance-restaurant-merge-game', label: 'Romance Restaurant / merge game' },
  { value: 'bedtime-find-watch', label: 'Bedtime “find something to watch”' },
  { value: 'avoiding-real-life-tasks', label: 'Avoiding real life tasks' },
]

const DOPAMINE_STATES: Array<{ value: Iris365DopamineState; label: string }> = [
  { value: 'just-woke-empty', label: 'Just woke up and feel empty' },
  { value: 'afternoon-low-motivation', label: 'Afternoon low motivation' },
  { value: 'evening-cant-transition', label: 'Evening can’t transition' },
  { value: 'bedtime-cant-stop', label: 'Bedtime and can’t stop' },
  { value: 'pms-low-control', label: 'PMS / low self-control' },
  { value: 'avoiding-assignment-admin', label: 'Avoiding assignment or admin' },
  { value: 'english-feels-hard', label: 'English feels hard today' },
  { value: 'anxious-numb-out', label: 'Anxious and want to numb out' },
]

const DOPAMINE_OUTCOMES: Array<{ value: Iris365DopamineOutcome; label: string }> = [
  { value: 'redirected', label: '我被救回来了' },
  { value: 'delayed-urge', label: '我拖住了这个冲动' },
  { value: 'softer-option', label: '我换成了软一点的安慰' },
  { value: 'rabbit-hole-avoided', label: '我没有开新坑' },
  { value: 'saved-tomorrow', label: '我保住了明天' },
  { value: 'binged-but-noticed', label: '还是刷了，但我看见它了' },
  { value: 'need-sleep', label: '我需要睡觉' },
  { value: 'need-food', label: '我需要吃东西' },
  { value: 'need-comfort', label: '我需要被安慰一下' },
]

const DOPAMINE_FEEDBACK_REASONS: Array<{ value: Iris365DopamineFeedbackReason; label: string }> = [
  { value: 'too-many-steps', label: 'Too many steps' },
  { value: 'too-much-screen-time', label: 'Too much screen time' },
  { value: 'too-productive', label: 'Too productive' },
  { value: 'too-weak', label: 'Too weak / not comforting enough' },
  { value: 'keeps-me-awake', label: 'This would keep me awake' },
  { value: 'still-rabbit-hole', label: 'This still leads to a rabbit hole' },
  { value: 'not-realistic', label: 'Not realistic right now' },
  { value: 'other', label: 'Other' },
]

interface DopamineSuggestion {
  suggestionType: Iris365DopamineSuggestionType
  comfortOption: string
  wants: string
  steps: string[]
  dont: string[]
  after: string
  note: string
}

interface DopamineFeedbackPreferences {
  avoidScreenComfort: boolean
  avoidOutput: boolean
  shoppingWishlistRejected: boolean
  tooManySteps: boolean
  needsMoreComfort: boolean
  bestWorkingSwap?: string
}

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatShortDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function formatSaveTime(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
}

function ratingOptions(label: string, value: number, onChange: (value: number) => void) {
  return (
    <div className="iris365-rating" role="group" aria-label={label}>
      <span>{label}</span>
      <div>
        {[1, 2, 3, 4, 5].map(option => (
          <button
            key={option}
            type="button"
            className={value === option ? 'active' : ''}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}

function foundationPatch(key: 'sleepRhythmProtected' | 'bodyMoved' | 'oneRealThingDone', value: boolean): Partial<Iris365Entry> {
  if (key === 'sleepRhythmProtected') return { sleepRhythmProtected: value, sleepProtected: value }
  if (key === 'bodyMoved') return { bodyMoved: value, movement: value }
  return { oneRealThingDone: value, realityTask: value }
}

function foundationCopy(status: ReturnType<typeof calculateFoundationStatus>): string {
  if (status === 'Foundation day') return 'All three anchors held. Strong base.'
  if (status === 'Valid day') return 'Two anchors held. The day counts.'
  if (status === 'Recovery day') return 'One anchor held. That still matters.'
  return 'Pattern spotted, not failure. Reduce friction and keep the next step small.'
}

function proofSourceLine(key: Iris365ProofKey, manualDone: boolean, sync: ReturnType<typeof getIris365DailyAnchorSync>): string {
  if (key === 'body' && sync.bodyMovedAuto) return `Auto from Exercise · ${sync.bodyMovedMinutes} min`
  if (key === 'english' && sync.englishOutputAuto) return `Auto from English Output Journey · ${sync.englishOutputReps} rep${sync.englishOutputReps === 1 ? '' : 's'}`
  if (manualDone) return 'Manual proof'
  return 'Not recorded yet'
}

function getMainGrowthTask(entry: Iris365Entry): string {
  if (entry.realThingToday.trim()) return entry.realThingToday.trim()
  const match = GROWTH_FIELDS.find(field => entry[field.key])
  return match?.label ?? ''
}

function updateStimulusControlledFlag(patterns: Iris365Entry['highStimulusPatterns']): boolean {
  const statuses = Object.values(patterns)
  return statuses.includes('controlled') && !statuses.includes('overused')
}

function updateProofCompletion(entry: Iris365Entry, proofKey: Iris365ProofKey, completed: boolean): Iris365Entry['proofs'] {
  return {
    ...entry.proofs,
    [proofKey]: {
      ...entry.proofs[proofKey],
      completed,
    },
  }
}

function dayTypeCopy(dayType: Iris365DayType): string {
  if (dayType === 'drift') return 'A drift day is information, not failure. Keep the three anchors small.'
  if (dayType === 'recovery') return 'Recovery days still count when the foundation stays visible.'
  if (dayType === 'push') return 'Push only from stability. Extra output is optional, not punishment.'
  return 'Normal days are for steady repetition and one visible proof.'
}

function dopamineStateLabel(value: Iris365DopamineState | null): string {
  return DOPAMINE_STATES.find(item => item.value === value)?.label ?? 'None yet'
}

function buildDopamineFeedbackPreferences(
  library: Iris365DopamineSwapLibraryItem[],
  urge: Iris365DopamineUrge,
  state: Iris365DopamineState,
): DopamineFeedbackPreferences {
  const related = library.filter(item =>
    item.urge === urge ||
    item.state === state ||
    (state === 'bedtime-cant-stop' && item.suggestionType === 'bedtime-shutdown') ||
    (state === 'english-feels-hard' && item.suggestionType === 'english-soft-mode') ||
    (urge === 'shopping-price-checking' && item.suggestionType === 'shopping-wishlist'),
  )
  const rejectedReasons = related
    .filter(item => item.status === 'doesnt-work')
    .map(item => item.feedbackReason)
  const bestWorkingSwap = related
    .filter(item => item.status === 'works')
    .sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0))[0]?.text

  return {
    avoidScreenComfort: rejectedReasons.includes('too-much-screen-time') || rejectedReasons.includes('keeps-me-awake'),
    avoidOutput: rejectedReasons.includes('too-productive'),
    shoppingWishlistRejected: rejectedReasons.includes('not-realistic') || rejectedReasons.includes('too-many-steps'),
    tooManySteps: rejectedReasons.includes('too-many-steps'),
    needsMoreComfort: rejectedReasons.includes('too-weak'),
    bestWorkingSwap,
  }
}

function applyFeedbackToSuggestion(
  suggestion: DopamineSuggestion,
  feedback: DopamineFeedbackPreferences,
  planB: boolean,
): DopamineSuggestion {
  const next = { ...suggestion, steps: [...suggestion.steps], dont: [...suggestion.dont] }
  if (feedback.bestWorkingSwap && !planB) {
    next.steps = [
      `Start with what already worked for Iris: ${feedback.bestWorkingSwap}.`,
      ...next.steps.filter(step => !step.includes(feedback.bestWorkingSwap ?? '')),
    ]
    next.note = `${next.note} Saved preference noticed: I’ll offer the proven thing earlier.`
  }
  if (feedback.tooManySteps) {
    next.steps = next.steps.slice(0, 3)
    next.note = `${next.note} Keeping this shorter because long instructions did not help before.`
  }
  if (feedback.needsMoreComfort) {
    next.steps = [
      'Start with the most comforting option first, not the most productive-looking one.',
      ...next.steps,
    ].slice(0, 4)
  }
  return next
}

function buildDopamineSwapSuggestion(
  urge: Iris365DopamineUrge,
  state: Iris365DopamineState,
  feedback: DopamineFeedbackPreferences,
  planB = false,
): DopamineSuggestion {
  const bedtime = state === 'bedtime-cant-stop' || urge === 'bedtime-find-watch'
  const pms = state === 'pms-low-control'
  const englishHard = state === 'english-feels-hard'
  const fragile = bedtime || pms || englishHard || state === 'just-woke-empty'

  if (planB) {
    if (bedtime && feedback.avoidScreenComfort) {
      return {
        suggestionType: 'bedtime-shutdown',
        comfortOption: 'Plan B: no-screen shutdown. Audio/body comfort only.',
        wants: 'Your brain wants a soft landing, but screen comfort is too sticky tonight.',
        steps: [
          'Put the phone face down or on charge.',
          'Turn on Brownian noise with rain and thunder.',
          'Make water or Ceylon/Assam milk tea if your body is still asking.',
          'One line only: “Tomorrow-Iris needs ____.” Then stop.',
        ],
        dont: [
          'No TV, no trailers, no “find something”.',
          'No shopping tabs.',
          'No new plot. Familiar audio is the ceiling.',
        ],
        after: 'After 10 minutes: sleep is Plan A now. If comfort continues, keep it audio-only.',
        note: 'Got it. Screen comfort can be too grabby at bedtime, so this Plan B removes the shiny door handle.',
      }
    }
    if (urge === 'shopping-price-checking' && feedback.shoppingWishlistRejected) {
      return {
        suggestionType: 'shopping-wishlist',
        comfortOption: 'Plan B: close tab + save price only.',
        wants: 'A sense of control without turning tonight into a product research internship.',
        steps: [
          'Copy only the item name and price.',
          'Paste it into a note called “Maybe later”.',
          'Close the tab immediately.',
        ],
        dont: [
          'No wishlist formatting.',
          'No comparisons.',
          'No sale timer negotiations.',
        ],
        after: 'After 10 minutes: if you still care, the note exists. Buying still waits.',
        note: 'Wishlist was too much admin. This is the smaller trapdoor exit.',
      }
    }
    if (state === 'english-feels-hard' && feedback.avoidOutput) {
      return {
        suggestionType: 'english-soft-mode',
        comfortOption: 'Plan B: passive familiar English only.',
        wants: 'English connection without the “perform now” pressure.',
        steps: [
          'Play a familiar Modern Family / Brooklyn Nine-Nine / Fisk / Utopia scene, or familiar MM audiobook.',
          'No pausing. No shadowing. No sentence capture unless it happens by itself.',
          'Let your brain receive English like background warmth.',
        ],
        dont: [
          'No output task.',
          'No note-taking quota.',
          'No turning English into a tiny court case.',
        ],
        after: 'After 10 minutes: if your shoulders dropped even 2%, that was useful.',
        note: 'Too productive was correctly rejected. Passive familiar listening is enough today.',
      }
    }
    return {
      suggestionType: 'general-downshift',
      comfortOption: 'Plan B: softer and simpler. Body comfort first.',
      wants: 'Comfort without instructions multiplying like tabs.',
      steps: [
        'Choose one: milk tea, shower / wash hair, Brownian rain noise, or 10-minute walk.',
        'Do not add a second task until the first comfort is started.',
        'If you need proof, write only: “I noticed the spiral.”',
      ],
      dont: [
        'No productivity replacement.',
        'No new rabbit hole.',
        'No trying to become a different person in 10 minutes.',
      ],
      after: 'After 10 minutes: decide again from a slightly less hijacked brain.',
      note: 'Let’s try a softer Plan B.',
    }
  }

  if (state === 'bedtime-cant-stop') {
    return applyFeedbackToSuggestion({
      suggestionType: 'bedtime-shutdown',
      comfortOption: 'Shutdown mode: familiar comfort only, no new plot hole.',
      wants: 'Brain-off comfort, fake “one more thing”, and the feeling of not ending the day yet.',
      steps: [
        'Turn on Brownian noise with rain and thunder.',
        feedback.avoidScreenComfort
          ? 'Pick familiar audio only: Puckboy / Eden Finley / Saxon James, or Brownian rain noise.'
          : 'Pick one already-known comfort: Modern Family, Brooklyn Nine-Nine, Fisk, Utopia, or a familiar Puckboy / Eden Finley / Saxon James audiobook.',
        'Make Ceylon/Assam milk tea or water if your body is still asking for something.',
        'Write one tiny tomorrow note: “Do One Real Thing = ____.”',
      ],
      dont: [
        'No new plot.',
        'No new shopping tab.',
        'No Xiaohongshu “just to find a vibe”.',
        'No replanning your whole life at midnight. Tiny CEO can clock out.',
      ],
      after: 'After 10 minutes: if you still want comfort, keep the same familiar thing. Do not open a new universe.',
      note: 'Bedtime Mode: protect tomorrow-Iris. She has done nothing to deserve a 2am cliffhanger.',
    }, feedback, planB)
  }
  if (state === 'pms-low-control') {
    return applyFeedbackToSuggestion({
      suggestionType: 'pms-damage-reduction',
      comfortOption: 'PMS mode: reduce damage, do not negotiate with the algorithm.',
      wants: 'Comfort, control, softness, and a fast reward without having to be impressive.',
      steps: [
        'Choose one body comfort first: shower / wash hair, milk tea, blanket, or Brownian rain noise.',
        'If you need a screen, choose Modern Family / B99 / Fisk / Utopia only. Familiar means exit doors exist.',
        urge === 'shopping-price-checking'
          ? 'Move the item to a 24-hour wishlist note. No buying, no comparing, no “but the sale ends”.'
          : 'If your hands need something, clear one tiny surface or hold tea. No heroic reset.',
        'Say: “This is hormone weather. I am not making life conclusions tonight.”',
      ],
      dont: [
        'No big shopping decisions.',
        'No judging your entire future.',
        'No starting new dramas or novels at night.',
        'No shame-based productivity language. Absolutely banned from the group chat.',
      ],
      after: 'After 10 minutes: choose sleep, food, or familiar comfort. Any of those counts.',
      note: 'PMS / low-control mode: damage reduction is the win condition.',
    }, feedback, planB)
  }

  if (urge === 'shopping-price-checking') {
    return applyFeedbackToSuggestion({
      suggestionType: 'shopping-wishlist',
      comfortOption: '24-hour wishlist cooling-off: keep the desire, delay the decision.',
      wants: 'Control, novelty, imagined future-self upgrade, and a tiny dopamine checkout sparkle.',
      steps: [
        feedback.shoppingWishlistRejected
          ? 'Save only the item name and price. No wishlist formatting.'
          : 'Put the exact item, price, and reason into a wishlist note.',
        feedback.shoppingWishlistRejected
          ? 'Close the tab immediately after saving the price.'
          : 'Add one line: “What problem do I think this solves?”',
        fragile ? 'Make milk tea or turn on Brownian rain noise. No replacement study required.' : 'Save one resume bullet or work note if your brain wants a useful micro-win.',
        'Close the tab. If it is still good tomorrow, it can survive 24 hours.',
      ],
      dont: [
        'No price checking spiral.',
        'No “while I’m here” browsing.',
        'No buying at bedtime.',
        'No letting a sale timer become your project manager.',
      ],
      after: 'After 10 minutes: decide only whether to keep it on the wishlist. Purchase decisions wait 24 hours.',
      note: 'Shopping urge is often control wearing a cute little outfit.',
    }, feedback, planB)
  }

  if (urge === 'ai-short-dramas' || urge === 'chinese-web-novels') {
    const storyLabel = urge === 'ai-short-dramas' ? 'AI short drama' : 'Chinese web novel'
    return applyFeedbackToSuggestion({
      suggestionType: 'story-familiar-comfort',
      comfortOption: `Do not open a new ${storyLabel} plot hole. Swap to known-story comfort.`,
      wants: 'Narrative escape, romance/justice payoff, novelty, and “please take me out of my real life for a second.”',
      steps: [
        'Choose familiar story comfort only: Puckboy / Eden Finley / Saxon James audiobook, or a known Modern Family / B99 episode.',
        'Set the 10-minute redirect. The job is not productivity; the job is avoiding a new cliffhanger.',
        englishHard ? 'If English feels hard, just catch one English sentence you like. No notes, no performance.' : 'If you want one tiny real-life anchor, write one Do One Real Thing.',
        'Keep the screen dim or audio-only if it is evening.',
      ],
      dont: [
        `No starting a new ${storyLabel}.`,
        'No “just chapter one”. That phrase has committed crimes.',
        'No comment-section archaeology.',
        'No turning comfort into punishment afterward.',
      ],
      after: 'After 10 minutes: if you still need story, continue the familiar one. New plot holes remain closed.',
      note: 'The win is not “be productive”. The win is not handing your evening to a cliffhanger machine.',
    }, feedback, planB)
  }

  if (urge === 'xiaohongshu-scrolling') {
    return applyFeedbackToSuggestion({
      suggestionType: 'xiaohongshu-algorithm-exit',
      comfortOption: 'Do not let the algorithm decide what Iris needs.',
      wants: 'Novelty, identity browsing, aesthetic control, and the feeling that someone else knows what to do.',
      steps: [
        'Close Xiaohongshu and name the category: beauty, study, lifestyle, jobs, or “I don’t know, vibes”.',
        'Choose one real alternative: clear one tiny surface, make milk tea, or take a 10-minute walk.',
        state === 'anxious-numb-out'
          ? 'Write one line: “The thing I am numbing is probably ____.” No solving.'
          : 'If you want input, use familiar audio instead of algorithm input.',
        'If you found something useful, save only one note. Do not keep scrolling to become a better person by osmosis.',
      ],
      dont: [
        'No “just five minutes”.',
        'No comparing your life to curated girls with ring lights.',
        'No buying a new identity starter pack.',
        'No algorithm-as-therapist.',
      ],
      after: 'After 10 minutes: choose one human thing: tea, shower, walk, sleep, or one real task edge.',
      note: 'Xiaohongshu is not the boss of Iris. It is a glittery slot machine with skincare lighting.',
    }, feedback, planB)
  }

  if (urge === 'romance-restaurant-merge-game') {
    return applyFeedbackToSuggestion({
      suggestionType: 'merge-visible-completion',
      comfortOption: 'Replace the merge loop with a tiny visible completion loop.',
      wants: 'Fast reward, tidy progress bars, cute control, and a world where tasks actually stay done.',
      steps: [
        'Set a 10-minute timer and clear one tiny surface: desk corner, bedside, one cup, one wrapper zone.',
        'If moving feels impossible, make Ceylon/Assam milk tea and turn on Brownian rain noise.',
        fragile ? 'No study replacement. Just a soft exit ramp.' : 'Save one resume bullet or work note if you want a real progress ping.',
        'Let the game wait. It will still have tomatoes / gems / chaos later.',
      ],
      dont: [
        'No “one more level”.',
        'No ad reward chain.',
        'No spending to speed up fake progress.',
        'No calling yourself lazy because a game was engineered well.',
      ],
      after: 'After 10 minutes: if you play, choose a time box on purpose. No accidental restaurant empire.',
      note: 'The real-life merge item is one tiny surface. Annoyingly effective.',
    }, feedback, planB)
  }

  if (urge === 'avoiding-real-life-tasks' || state === 'avoiding-assignment-admin') {
    return applyFeedbackToSuggestion({
      suggestionType: 'real-life-edge',
      comfortOption: 'Open the smallest real-life edge. Not the whole life, just the edge.',
      wants: 'Escape from ambiguity, fear of starting wrong, and relief from admin-shaped fog.',
      steps: [
        'Write one “Do One Real Thing”: one sentence, one email title, one file name, one bill check, one assessment heading.',
        englishHard ? 'If English is hard, capture one English sentence only. Do not force output.' : 'If work mode is available, save one resume bullet or work note.',
        'Pair it with a comfort anchor: milk tea, Brownian rain noise, or a familiar sitcom queued for after.',
        'Stop after 10 minutes unless momentum feels genuinely kind.',
      ],
      dont: [
        'No rebuilding the whole plan.',
        'No opening five tabs “for research”.',
        'No deciding your future from one admin task.',
        'No hard study as self-punishment.',
      ],
      after: 'After 10 minutes: decide whether to continue, switch to comfort, or sleep. All allowed.',
      note: 'Avoidance usually needs a smaller door, not a courtroom drama.',
    }, feedback, planB)
  }

  if (state === 'english-feels-hard') {
    return applyFeedbackToSuggestion({
      suggestionType: 'english-soft-mode',
      comfortOption: 'English soft mode: one sentence only, no pressure.',
      wants: 'Avoiding performance pressure while still wanting to feel connected to English-Iris.',
      steps: [
        'Pick familiar input: Modern Family / B99 / Fisk / Utopia or familiar MM audiobook.',
        feedback.avoidOutput
          ? 'Do not capture anything unless it happens by accident. Passive listening only.'
          : 'Capture one English sentence only if it naturally pops out.',
        'No shadowing, no drilling, no “I should be fluent by now” speech.',
        'Make milk tea or take a 10-minute walk if your brain refuses language today.',
      ],
      dont: [
        'No hard study replacement.',
        'No comparing accents.',
        'No turning English into a moral exam.',
        'No new addictive plot as “English practice”. Sneaky, but no.',
      ],
      after: 'After 10 minutes: one sentence counts. Zero sentences plus calmer nervous system also counts.',
      note: 'English Output Journey can have soft days. The streak does not need a dramatic monologue.',
    }, feedback, planB)
  }

  if (state === 'just-woke-empty') {
    return applyFeedbackToSuggestion({
      suggestionType: 'morning-empty',
      comfortOption: 'Morning emptiness protocol: body first, internet later.',
      wants: 'A quick identity refill before the day has shape.',
      steps: [
        'Water or Ceylon/Assam milk tea first.',
        'Open curtains or take a 10-minute walk if possible.',
        'Write one Do One Real Thing for today.',
        'Choose one familiar comfort only after the day has one tiny anchor.',
      ],
      dont: [
        'No algorithm before the day has a spine.',
        'No shopping identity search.',
        'No new drama while half-awake.',
      ],
      after: 'After 10 minutes: choose the next smallest block, not the perfect morning personality.',
      note: 'Waking up empty is a state, not a prophecy.',
    }, feedback, planB)
  }

  return applyFeedbackToSuggestion({
    suggestionType: 'general-downshift',
    comfortOption: 'Iris-style downshift: soft comfort plus one tiny real anchor.',
    wants: 'Comfort, escape, control, and a fast reward without being swallowed by the internet.',
    steps: [
      'Turn on Brownian noise with rain and thunder, or choose a familiar comfort show.',
      'Make milk tea, shower / wash hair, or take a 10-minute walk.',
      fragile ? 'Skip hard study. Capture one English sentence only if it feels easy.' : 'Write one Do One Real Thing or save one work note.',
      'Close the thing that was trying to open a new rabbit hole.',
    ],
    dont: [
      'No new plot hole.',
      'No shopping spiral.',
      'No shame productivity.',
      'No letting the algorithm pick your next personality.',
    ],
    after: 'After 10 minutes: decide again like a kind person, not a productivity police officer.',
    note: 'Comfort is allowed. The mission is simply to choose a softer doorway.',
  }, feedback, planB)
}

export default function Iris365() {
  const today = getLocalDateKey()
  const [store, setStore] = useState(() => loadIris365Store())
  const [entry, setEntry] = useState<Iris365Entry>(() => loadIris365Entry(today, store))
  const [proofCategoryFilter, setProofCategoryFilter] = useState<Iris365ProofCategory | 'All'>('All')
  const [proofDraft, setProofDraft] = useState({
    category: 'English output' as Iris365ProofCategory,
    title: '',
    description: '',
    linkOrFile: '',
  })
  const [swapUrge, setSwapUrge] = useState<Iris365DopamineUrge | ''>('')
  const [swapState, setSwapState] = useState<Iris365DopamineState | ''>('')
  const [activeSwapLog, setActiveSwapLog] = useState<Iris365DopamineSwapLog | null>(null)
  const [swapFeedbackMessage, setSwapFeedbackMessage] = useState('')
  const [rejectSelectorOpen, setRejectSelectorOpen] = useState(false)
  const [suggestionMode, setSuggestionMode] = useState<'primary' | 'plan-b'>('primary')
  const [entrySaveState, setEntrySaveState] = useState<{
    status: 'idle' | 'saved' | 'error'
    savedAt?: string
    message?: string
  }>(() => ({
    status: store.entries[today] ? 'saved' : 'idle',
    savedAt: store.entries[today]?.updatedAt,
  }))

  const dayNumber = calculateCurrentDayNumber(IRIS_365_START_DATE, today)
  const daysRemaining = calculateDaysRemaining(IRIS_365_START_DATE, today)
  const preStart = isBeforeIris365Start(today, IRIS_365_START_DATE)
  const phase = determineCurrentPhase(Math.max(1, dayNumber))
  const progress = iris365ProgressPercent(dayNumber)
  const anchorSync = getIris365DailyAnchorSync(today)
  const bodyMovedDone = entry.bodyMoved || anchorSync.bodyMovedAuto
  const englishOutputDone = entry.englishOutput || anchorSync.englishOutputAuto
  const oneRealThingDone = entry.oneRealThingDone
  const foundationScore = [bodyMovedDone, englishOutputDone, oneRealThingDone].filter(Boolean).length
  const foundationStatus = foundationStatusForScore(foundationScore)
  const stats = useMemo(() => calculateIris365Stats(store.entries, today), [store.entries, today])
  const recentEntries = useMemo(() => recentIris365Entries(store.entries, 7), [store.entries])
  const weekStart = getIris365WeekStart(today)
  const weeklyReview = store.weeklyReviews[weekStart] ?? emptyIris365WeeklyReview(weekStart)
  const monthId = getIris365MonthId(today)
  const monthlyReview = store.monthlyReviews[monthId] ?? emptyIris365MonthlyReview(monthId)
  const weekEntries = getIris365WeekEntries(store.entries, weekStart)
  const weeklyStats = calculateIris365Stats(Object.fromEntries(weekEntries.map(item => [item.date, item])), today)
  const dopamineStats = getIris365DopamineWeekStats(store, today)
  const filteredProofItems = store.proofItems.filter(item => proofCategoryFilter === 'All' || item.category === proofCategoryFilter)
  const savedToday = Boolean(store.entries[today])
  const entrySavedTime = formatSaveTime(entrySaveState.savedAt ?? entry.updatedAt)
  const dopamineFeedback = swapUrge && swapState
    ? buildDopamineFeedbackPreferences(store.dopamineSwapLibrary, swapUrge, swapState)
    : null
  const activeSuggestion = swapUrge && swapState && dopamineFeedback
    ? buildDopamineSwapSuggestion(swapUrge, swapState, dopamineFeedback, suggestionMode === 'plan-b')
    : null

  function updateEntry(patch: Partial<Iris365Entry>) {
    if (preStart) return
    const updatedAt = new Date().toISOString()
    const next = {
      ...entry,
      ...patch,
      date: today,
      updatedAt,
    }
    try {
      const nextStore = saveIris365Entry(next, store)
      setEntry(next)
      setStore(nextStore)
      setEntrySaveState({ status: 'saved', savedAt: updatedAt })
    } catch (error) {
      setEntrySaveState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Could not save Iris365. Try again.',
      })
    }
  }

  function updateStimulusPattern(key: Iris365HighStimulusPatternKey, status: Iris365HighStimulusPatternStatus) {
    const patterns = {
      ...entry.highStimulusPatterns,
      [key]: status,
    }
    updateEntry({
      highStimulusPatterns: patterns,
      highStimulusControlled: updateStimulusControlledFlag(patterns),
    })
  }

  function updateWeeklyReview(patch: Partial<Iris365WeeklyReview>) {
    const next = {
      ...weeklyReview,
      ...patch,
      updatedAt: new Date().toISOString(),
    }
    setStore(saveIris365WeeklyReview(next, store))
  }

  function updateMonthlyReview(patch: Partial<Iris365MonthlyReview>) {
    const next = {
      ...monthlyReview,
      ...patch,
      monthId,
      phase: patch.phase ?? (monthlyReview.phase || phase.title),
      updatedAt: new Date().toISOString(),
    }
    setStore(saveIris365MonthlyReview(next, store))
  }

  function saveProofItem() {
    const title = proofDraft.title.trim()
    if (!title) return
    setStore(addIris365ProofItem({
      date: today,
      category: proofDraft.category,
      title,
      description: proofDraft.description.trim(),
      linkOrFile: proofDraft.linkOrFile.trim(),
      source: 'manual',
      relatedEntryDate: store.entries[today] ? today : undefined,
    }, store))
    setProofDraft({
      category: proofDraft.category,
      title: '',
      description: '',
      linkOrFile: '',
    })
  }

  function applyProofChip(chip: typeof PROOF_QUICK_CHIPS[number]) {
    setProofDraft({
      category: chip.category,
      title: chip.label,
      description: chip.description,
      linkOrFile: proofDraft.linkOrFile,
    })
  }

  function saveRealThingAsProof() {
    const title = entry.realThingToday.trim()
    if (!title) return
    const nextStore = addIris365ProofItem({
      date: today,
      category: 'Personal insight',
      title,
      description: 'One real thing counts. 这说明我没有原地踏步。',
      linkOrFile: '',
      source: 'manual',
      relatedEntryDate: today,
    }, store)
    setStore(nextStore)
    setProofDraft({
      category: 'Personal insight',
      title: '',
      description: '',
      linkOrFile: '',
    })
  }

  function startDopamineSwap() {
    if (!swapUrge || !swapState || !activeSuggestion) return
    const nextStore = addIris365DopamineSwapLog({
      date: today,
      urge: swapUrge,
      state: swapState,
      suggestion: `${activeSuggestion.wants} ${activeSuggestion.note}`,
      comfortOption: activeSuggestion.comfortOption,
      tinyAction: activeSuggestion.steps[0],
    }, store)
    setStore(nextStore)
    setActiveSwapLog(nextStore.dopamineSwapLogs[0] ?? null)
  }

  function logDopamineOutcome(outcome: Iris365DopamineOutcome) {
    if (!activeSwapLog) return
    const nextStore = updateIris365DopamineSwapLog(activeSwapLog.id, {
      outcome,
      completedAt: new Date().toISOString(),
    }, store)
    setStore(nextStore)
    setActiveSwapLog(null)
  }

  function resetSwapFeedback() {
    setSwapFeedbackMessage('')
    setRejectSelectorOpen(false)
    setSuggestionMode('primary')
  }

  function handleSaveUsefulSwap() {
    if (!activeSuggestion || !swapUrge || !swapState) return
    setStore(saveIris365SwapLibraryItem({
      text: activeSuggestion.comfortOption,
      urge: swapUrge,
      state: swapState,
      suggestionType: activeSuggestion.suggestionType,
      status: 'works',
    }, store))
    setRejectSelectorOpen(false)
    setSwapFeedbackMessage('Saved. I’ll suggest this earlier next time.')
  }

  function openRejectSelector() {
    if (!activeSuggestion) return
    setRejectSelectorOpen(true)
    setSwapFeedbackMessage('')
  }

  function handleRejectSwap(reason: Iris365DopamineFeedbackReason) {
    if (!activeSuggestion || !swapUrge || !swapState) return
    const nextStore = saveIris365SwapLibraryItem({
      text: activeSuggestion.comfortOption,
      urge: swapUrge,
      state: swapState,
      suggestionType: activeSuggestion.suggestionType,
      feedbackReason: reason,
      status: 'doesnt-work',
    }, store)
    setStore(nextStore)
    setRejectSelectorOpen(false)
    setSuggestionMode('plan-b')
    setSwapFeedbackMessage('Got it. I’ll avoid this next time. Let’s try a softer Plan B.')
  }

  return (
    <div className="page iris365-page">
      <div className="page-header">
        <div className="section-label">Small daily proof</div>
        <h2 className="page-title">Iris 365</h2>
        <p className="page-subtitle">Build the foundation first. Small daily proof, not perfection.</p>
      </div>

      <section className="iris365-countdown-card iris365-countdown-card-compact">
        <div className="iris365-countdown-main">
          <div className="card-title-row">
            <CalendarDays size={17} />
            <h3>{preStart ? 'Starts tomorrow' : `Day ${dayNumber} / 365`}</h3>
          </div>
          <p>{phase.title}</p>
          <div className="iris365-progress-bar" aria-label={`Iris 365 progress ${progress}%`}>
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="iris365-countdown-stats iris365-countdown-stats-compact">
          <div>
            <span>{daysRemaining}</span>
            <small>days left</small>
          </div>
          <div>
            <span>{progress}%</span>
            <small>progress</small>
          </div>
          <div>
            <span>Phase {phase.id}</span>
            <small>{phase.focus}</small>
          </div>
        </div>
      </section>

      {!preStart && (
        <section className="iris365-daily-system-card">
          <div className="card-header">
            <div>
              <div className="section-label">Today foundation system</div>
              <div className="card-title">Small daily proof, not perfection.</div>
            </div>
            <span className={`iris365-save-pill ${savedToday ? 'saved' : ''}`}>
              {savedToday ? 'Saved today' : 'Not saved yet'}
            </span>
          </div>

          <div className="iris365-daily-controls">
            <div>
              <span>Day type</span>
              <div className="iris365-pill-options">
                {DAY_TYPE_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    className={entry.dayType === option.value ? 'active' : ''}
                    onClick={() => updateEntry({ dayType: option.value })}
                  >
                    {option.label}
                    <small>{option.hint}</small>
                  </button>
                ))}
              </div>
            </div>
            <label>
              Energy
              <select value={entry.energyLevel} onChange={event => updateEntry({ energyLevel: event.target.value as Iris365Entry['energyLevel'] })}>
                {ENERGY_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              Main focus
              <select value={entry.mainFocus} onChange={event => updateEntry({ mainFocus: event.target.value as Iris365Entry['mainFocus'] })}>
                {(Object.keys(SKILL_LABELS) as Array<Iris365SkillKey | 'foundation'>).map(key => (
                  <option key={key} value={key}>{SKILL_LABELS[key]}</option>
                ))}
              </select>
            </label>
          </div>

          <p className="iris365-daytype-copy">{dayTypeCopy(entry.dayType)}</p>

          <label className="iris365-single-field iris365-today-proved-field">
            Today I proved
            <input
              value={entry.todayIProved}
              onChange={event => updateEntry({ todayIProved: event.target.value, tinyWin: event.target.value })}
              placeholder="e.g. I can restart gently; I can finish one real thing; I can speak one useful sentence"
            />
          </label>
        </section>
      )}

      <section className="iris365-layout">
        <div className="iris365-main-stack">
          {!preStart && (
            <section className="iris365-daily-proof-card">
              <div className="card-header">
                <div>
                  <div className="section-label">Daily essentials</div>
                  <div className="card-title">Three anchors for stability in Australia</div>
                </div>
              </div>
              <div className="iris365-daily-proof-grid">
                {DAILY_PROOF_ORDER.map(key => {
                  const proof = entry.proofs[key]
                  const proofCompleted = key === 'body'
                    ? proof.completed || anchorSync.bodyMovedAuto
                    : key === 'english'
                      ? proof.completed || anchorSync.englishOutputAuto
                      : proof.completed
                  return (
                    <article key={key} className={`iris365-proof-anchor ${proofCompleted ? 'done' : ''}`}>
                      <label>
                        <input
                          type="checkbox"
                          checked={proofCompleted}
                          onChange={event => {
                            const completed = event.target.checked
                            updateEntry({
                              proofs: updateProofCompletion(entry, key, completed),
                              ...(key === 'body' ? { bodyMoved: completed, movement: completed } : {}),
                              ...(key === 'english' ? { englishOutput: completed } : {}),
                              ...(key === 'realWorld' ? { oneRealThingDone: completed, realityTask: completed } : {}),
                            })
                          }}
                        />
                        <span>{proof.label}</span>
                      </label>
                      <small className={`iris365-proof-source ${proofCompleted ? 'active' : ''}`}>
                        {proofSourceLine(key, proof.completed, anchorSync)}
                      </small>
                      <p>{proof.description}</p>
                      <details>
                        <summary>Minimum / standard / push</summary>
                        <ul>
                          <li><strong>Minimum:</strong> {proof.minimum}</li>
                          <li><strong>Standard:</strong> {proof.standard}</li>
                          <li><strong>Push:</strong> {proof.push}</li>
                        </ul>
                      </details>
                      <input
                        value={proof.note ?? ''}
                        onChange={event => updateEntry({
                          proofs: {
                            ...entry.proofs,
                            [key]: {
                              ...proof,
                              note: event.target.value,
                            },
                          },
                        })}
                        placeholder="Optional tiny note"
                      />
                    </article>
                  )
                })}
              </div>
            </section>
          )}

          <section className="iris365-foundation-card">
            <div className="card-header">
              <div>
                <div className="section-label">Foundation first</div>
                <div className="card-title">{formatShortDate(today)}</div>
              </div>
              <span className={`iris365-save-pill ${savedToday ? 'saved' : ''} ${entrySaveState.status === 'error' ? 'error' : ''}`}>
                {entrySaveState.status === 'error'
                  ? 'Save failed'
                  : savedToday
                    ? `Saved${entrySavedTime ? ` ${entrySavedTime}` : ''}`
                    : 'Not saved yet'}
              </span>
            </div>

            {preStart ? (
              <div className="iris365-prestart-note">
                <strong>Starts tomorrow</strong>
                <p>Get ready: choose your first tiny proof. The daily check-in unlocks on {formatDate(IRIS_365_START_DATE)}.</p>
              </div>
            ) : (
              <>
                <div className={`iris365-foundation-score status-${foundationScore}`}>
                  <span>{foundationScore} / 3</span>
                  <div>
                    <strong>{foundationStatus}</strong>
                    <small>{foundationCopy(foundationStatus)}</small>
                  </div>
                </div>
                <p className={`iris365-recording-helper ${entrySaveState.status === 'error' ? 'error' : ''}`}>
                  {entrySaveState.status === 'error'
                    ? `保存失败：${entrySaveState.message}`
                    : '勾选后会保存到今天的 Iris365 记录，用来计算当天基础锚点。不会算作 Study Session。'}
                </p>

                <DailyRhythmLog
                  className="iris365-rhythm-inline"
                  wakeTime={entry.wakeTime}
                  sleepTime={entry.sleepTime}
                  onWakeTimeChange={value => updateEntry({ wakeTime: value })}
                  onSleepTimeChange={value => updateEntry({ sleepTime: value })}
                />

                <div className="iris365-foundation-grid">
                  {FOUNDATION_FIELDS.map(item => {
                    const checked = item.key === 'bodyMoved' ? bodyMovedDone : entry[item.key]
                    return (
                      <label key={item.key} className="iris365-check-row iris365-foundation-row">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={event => {
                            const completed = event.target.checked
                            updateEntry({
                              ...foundationPatch(item.key, completed),
                              ...(item.key !== 'sleepRhythmProtected' ? { proofs: updateProofCompletion(entry, item.proofKey, completed) } : {}),
                            })
                          }}
                        />
                        <span>
                          <strong>{item.label}</strong>
                          <small>{item.hint}</small>
                          {item.key === 'bodyMoved' && (
                            <small className={`iris365-proof-source ${bodyMovedDone ? 'active' : ''}`}>
                              {proofSourceLine('body', entry.bodyMoved, anchorSync)}
                            </small>
                          )}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </>
            )}
          </section>

          {!preStart && (
            <>
              <details className="hub-secondary-details iris365-secondary-details">
                <summary>More check-ins, context &amp; urge tools</summary>

              <section className="iris365-growth-card">
                <div className="card-header">
                  <div>
                    <div className="section-label">Growth tracking</div>
                    <div className="card-title">What supported today’s real thing?</div>
                  </div>
                </div>
                <div className="iris365-growth-grid">
                  {GROWTH_FIELDS.map(item => {
                    const checked = item.key === 'englishOutput' ? englishOutputDone : entry[item.key]
                    return (
                      <label key={item.key} className="iris365-check-row">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={event => {
                            const completed = event.target.checked
                            updateEntry({
                              [item.key]: completed,
                              skillTouches: {
                                ...entry.skillTouches,
                                ...(item.key === 'englishOutput' || item.key === 'shadowing' ? { english: completed } : {}),
                                ...(item.key === 'cyberAiProject' ? { cyber: completed, aiAutomation: completed } : {}),
                                ...(item.key === 'jobApplication' || item.key === 'workPrep' ? { career: completed } : {}),
                                ...(item.key === 'studyCoursework' ? { data: completed } : {}),
                                ...(item.key === 'lifeAdmin' ? { lifeSystem: completed } : {}),
                              },
                            })
                          }}
                        />
                        <span>
                          <strong>{item.label}</strong>
                          <small>{item.hint}</small>
                          {item.key === 'englishOutput' && (
                            <small className={`iris365-proof-source ${englishOutputDone ? 'active' : ''}`}>
                              {proofSourceLine('english', entry.englishOutput, anchorSync)}
                            </small>
                          )}
                        </span>
                      </label>
                    )
                  })}
                </div>
                <label className="iris365-single-field">
                  What was the real thing today?
                  <input
                    value={entry.realThingToday}
                    onChange={event => updateEntry({ realThingToday: event.target.value })}
                    placeholder="e.g. Finished one Coursera lesson, sent one application, fixed one bug"
                  />
                </label>
                {entry.realThingToday.trim() && !store.proofItems.some(item => item.relatedEntryDate === today && item.title === entry.realThingToday.trim()) && (
                  <div className="iris365-real-thing-proof-prompt">
                    <span>要不要存成一个小证据？</span>
                    <small>不是没进步，是进步太碎。One tiny proof is enough.</small>
                    <button type="button" className="btn btn-secondary" onClick={saveRealThingAsProof}>
                      Save tiny proof
                    </button>
                  </div>
                )}
                <details className="iris365-english-output-details">
                  <summary>English output note</summary>
                  <div className="iris365-detail-grid">
                    <label>
                      Topic
                      <input
                        value={entry.englishOutputDetail.topic ?? ''}
                        onChange={event => updateEntry({ englishOutputDetail: { ...entry.englishOutputDetail, topic: event.target.value } })}
                        placeholder="What did I speak/write about?"
                      />
                    </label>
                    <label>
                      Useful expression
                      <input
                        value={entry.englishOutputDetail.usefulExpression ?? ''}
                        onChange={event => updateEntry({ englishOutputDetail: { ...entry.englishOutputDetail, usefulExpression: event.target.value } })}
                        placeholder="One phrase worth reusing"
                      />
                    </label>
                    <label>
                      Confidence 1-5
                      <input
                        type="number"
                        min="1"
                        max="5"
                        value={entry.englishOutputDetail.confidence ?? ''}
                        onChange={event => updateEntry({ englishOutputDetail: { ...entry.englishOutputDetail, confidence: Number(event.target.value) || undefined } })}
                        placeholder="3"
                      />
                    </label>
                  </div>
                </details>
              </section>

              <section className="iris365-details-card">
                <div className="card-header">
                  <div>
                    <div className="section-label">Daily details</div>
                    <div className="card-title">Optional context</div>
                  </div>
                </div>
                <div className="iris365-detail-grid">
                  <label>
                    Movement type
                    <input value={entry.movementType} onChange={event => updateEntry({ movementType: event.target.value })} placeholder="Walk, stretch, gym, chores" />
                  </label>
                </div>
                <div className="iris365-rating-grid">
                  {ratingOptions('Mood', entry.mood, mood => updateEntry({ mood }))}
                  {ratingOptions('Energy', entry.energy, energy => updateEntry({ energy }))}
                </div>
                <div className="iris365-form-grid">
                  <label>
                    Tiny win
                    <input
                      value={entry.tinyWin}
                      onChange={event => updateEntry({ tinyWin: event.target.value })}
                      placeholder="One small piece of proof from today"
                    />
                  </label>
                  <label>
                    Notes
                    <textarea
                      value={entry.notes}
                      onChange={event => updateEntry({ notes: event.target.value })}
                      placeholder="What helped? What needs less friction tomorrow?"
                    />
                  </label>
                </div>
              </section>

              <section id="before-i-spiral" className="iris365-stimulus-card dopamine-swap-card">
                <div className="card-header">
                  <div>
                    <div className="section-label">Urge interruption</div>
                    <div className="card-title">Before I Spiral</div>
                  </div>
                </div>
                <p className="dopamine-swap-subtitle">
                  Feeling pulled into short dramas, web novels, shopping, scrolling, or games?
                  Choose a softer comfort for 10 minutes, then decide again.
                </p>

                <div className="dopamine-swap-grid">
                  <div className="dopamine-swap-step">
                    <span>Current urge</span>
                    <div className="dopamine-chip-grid">
                      {DOPAMINE_URGES.map(option => (
                        <button
                          key={option.value}
                          type="button"
                          className={swapUrge === option.value ? 'active' : ''}
                          onClick={() => {
                            setSwapUrge(option.value)
                            resetSwapFeedback()
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="dopamine-swap-step">
                    <span>Current state</span>
                    <div className="dopamine-chip-grid">
                      {DOPAMINE_STATES.map(option => (
                        <button
                          key={option.value}
                          type="button"
                          className={swapState === option.value ? 'active' : ''}
                          onClick={() => {
                            setSwapState(option.value)
                            resetSwapFeedback()
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {activeSuggestion ? (
                  <div className="dopamine-suggestion-card">
                    <div>
                      <div className="section-label">
                        {swapState === 'bedtime-cant-stop'
                          ? 'Bedtime mode'
                          : swapState === 'pms-low-control'
                            ? 'PMS / low-control mode'
                            : 'Iris downshift'}
                      </div>
                      <h4>{activeSuggestion.comfortOption}</h4>
                    </div>
                    <div className="dopamine-suggestion-section">
                      <span>What this urge probably wants</span>
                      <p>{activeSuggestion.wants}</p>
                    </div>
                    <div className="dopamine-suggestion-section">
                      <span>Iris-style 10-minute downshift</span>
                      <ol>
                        {activeSuggestion.steps.map(step => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                    </div>
                    <div className="dopamine-suggestion-section">
                      <span>Do not do right now</span>
                      <ul>
                        {activeSuggestion.dont.map(item => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="dopamine-suggestion-section">
                      <span>After 10 minutes</span>
                      <p>{activeSuggestion.after}</p>
                    </div>
                    <small>{activeSuggestion.note}</small>
                    <div className="dopamine-suggestion-actions">
                      <button type="button" className="btn btn-primary" onClick={startDopamineSwap}>
                        救我10分钟
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={handleSaveUsefulSwap}>
                        这个真的有用
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={openRejectSelector}>
                        这个对我没用
                      </button>
                    </div>
                    {swapFeedbackMessage && (
                      <div className={`dopamine-feedback-message ${suggestionMode === 'plan-b' ? 'plan-b' : ''}`}>
                        {swapFeedbackMessage}
                      </div>
                    )}
                    {rejectSelectorOpen && (
                      <div className="dopamine-feedback-card" role="group" aria-label="哪里没用？">
                        <div>
                          <span>哪里没用？</span>
                          <small>点一下就好，不做问卷。Iris 只是帮自己调参。</small>
                        </div>
                        <div className="dopamine-feedback-options">
                          {DOPAMINE_FEEDBACK_REASONS.map(reason => (
                            <button key={reason.value} type="button" onClick={() => handleRejectSwap(reason.value)}>
                              {reason.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="dopamine-empty-suggestion">
                    选一个冲动 + 当前状态，我给 Iris 一个 10 分钟下坡，不讲大道理。
                  </div>
                )}

                {activeSwapLog && (
                  <div className="dopamine-result-log">
                    <div>
                      <div className="section-label">After 10 minutes</div>
                      <h4>What happened?</h4>
                    </div>
                    <div className="dopamine-outcome-grid">
                      {DOPAMINE_OUTCOMES.map(option => (
                        <button key={option.value} type="button" onClick={() => logDopamineOutcome(option.value)}>
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="dopamine-swap-footer">
                  <div className="dopamine-weekly-stats">
                    <span>{dopamineStats.swapsAttempted}</span>
                    <small>swaps attempted</small>
                    <span>{dopamineStats.delayedCount}</span>
                    <small>urges delayed</small>
                    <span>{dopamineStats.rabbitHolesAvoided}</span>
                    <small>new rabbit holes avoided</small>
                    <span>{dopamineStats.savedTomorrowCount}</span>
                    <small>saved tomorrow</small>
                    <span>{dopamineStats.mostCommonState ? dopamineStateLabel(dopamineStats.mostCommonState) : 'None yet'}</span>
                    <small>most common trigger</small>
                    <span>{dopamineStats.mostEffectiveSavedSwap?.text ?? 'None yet'}</span>
                    <small>most effective Iris swap</small>
                  </div>

                  <div className="dopamine-saved-swaps">
                    <div className="section-label">Works for Iris</div>
                    {store.dopamineSwapLibrary.filter(item => item.status === 'works').slice(0, 3).length > 0 ? (
                      store.dopamineSwapLibrary.filter(item => item.status === 'works').slice(0, 3).map(item => (
                        <span key={item.id}>{item.text}</span>
                      ))
                    ) : (
                      <p>Save swaps that actually help Iris. No generic wellness wallpaper.</p>
                    )}
                    {dopamineStats.mostEffectiveSavedSwap && (
                      <small>Most effective: {dopamineStats.mostEffectiveSavedSwap.text}</small>
                    )}
                  </div>
                </div>

                <details className="dopamine-legacy-details">
                  <summary>Optional daily pattern note</summary>
                  <div className="iris365-stimulus-list">
                    {IRIS_365_HIGH_STIMULUS_PATTERNS.map(key => (
                      <div key={key} className="iris365-stimulus-row">
                        <span>{HIGH_STIMULUS_LABELS[key]}</span>
                        <div>
                          {(Object.keys(STIMULUS_STATUS_LABELS) as Iris365HighStimulusPatternStatus[]).map(status => (
                            <button
                              key={status}
                              type="button"
                              className={entry.highStimulusPatterns[key] === status ? 'active' : ''}
                              onClick={() => updateStimulusPattern(key, status)}
                            >
                              {STIMULUS_STATUS_LABELS[status]}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <label className="iris365-single-field">
                    What triggered it?
                    <input
                      value={entry.highStimulusTrigger}
                      onChange={event => updateEntry({ highStimulusTrigger: event.target.value })}
                      placeholder="Stress, boredom, transition gap, tired evening..."
                    />
                  </label>
                </details>
              </section>
              </details>
            </>
          )}
        </div>

        <aside className="iris365-stats-card">
          <section className="iris365-stat-panel">
            <div className="card-title-row">
              <TrendingUp size={16} />
              <h3>Foundation stats</h3>
            </div>
            <div className="iris365-stat-grid">
              {FOUNDATION_STATS.map(([key, label]) => (
                <div key={key}>
                  <span>{stats[key]}</span>
                  <small>{label}</small>
                </div>
              ))}
            </div>
          </section>
          <section className="iris365-stat-panel">
            <div className="card-title-row iris365-growth-stat-title">
              <ShieldCheck size={16} />
              <h3>Growth stats</h3>
            </div>
            <div className="iris365-stat-grid">
              {GROWTH_STATS.map(([key, label]) => (
                <div key={key}>
                  <span>{stats[key]}</span>
                  <small>{label}</small>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </section>

      <details className="iris365-progressive-details">
        <summary>
          <span>Weekly review</span>
          <small>{isIris365WeeklyReviewDay(today) ? 'Sunday review day' : 'Open when useful'}</small>
        </summary>
        <section className="iris365-weekly-card">
          <div className="card-header">
            <div>
              <div className="section-label">Sunday review</div>
              <div className="card-title">Weekly review</div>
            </div>
            <span>{formatDate(weeklyReview.weekStartDate)} - {formatDate(weeklyReview.weekEndDate)}</span>
          </div>
          <div className="iris365-weekly-summary">
            <span>English {weeklyStats.englishOutputDays}</span>
            <span>Real thing {weeklyStats.realThingDays}</span>
            <span>Movement {weeklyStats.movementDays}</span>
            <span>Stimulus {weeklyStats.highStimulusControlledDays}</span>
            <span>Sleep {weeklyStats.sleepRhythmProtectedDays}</span>
          </div>
          <div className="iris365-weekly-grid">
            {WEEKLY_REVIEW_FIELDS.map(([key, label]) => (
              <label key={key}>
                {label}
                <textarea
                  value={weeklyReview[key]}
                  onChange={event => updateWeeklyReview({ [key]: event.target.value })}
                />
              </label>
            ))}
          </div>
        </section>
      </details>

      <details className="iris365-progressive-details">
        <summary>
          <span>Monthly reflection</span>
          <small>What is changing slowly?</small>
        </summary>
        <section className="iris365-weekly-card iris365-monthly-card">
          <div className="card-header">
            <div>
              <div className="section-label">Monthly review</div>
              <div className="card-title">{monthId} · {monthlyReview.phase || phase.title}</div>
            </div>
          </div>
          <div className="iris365-weekly-grid">
            {([
              ['whatChanged', 'What changed this month?'],
              ['whatBecameEasier', 'What became easier?'],
              ['stillHard', 'What is still hard?'],
              ['whatIAvoided', 'What did I avoid?'],
              ['proudOf', 'What am I proud of?'],
              ['stopForcing', 'What should I stop forcing?'],
              ['nextSmallUpgrade', 'Next small upgrade'],
              ['visibleOutput', 'Visible output / proof'],
            ] as Array<[keyof Iris365MonthlyReview, string]>).map(([key, label]) => (
              <label key={key}>
                {label}
                <textarea
                  value={String(monthlyReview[key] ?? '')}
                  onChange={event => updateMonthlyReview({ [key]: event.target.value } as Partial<Iris365MonthlyReview>)}
                />
              </label>
            ))}
          </div>
        </section>
      </details>

      <details className="iris365-progressive-details">
        <summary>
          <span>Skill roadmap</span>
          <small>Long-term stability areas</small>
        </summary>
        <section className="iris365-skill-roadmap-card">
          {SKILL_ROADMAP.map(skill => (
            <article key={skill.key} className={entry.skillTouches[skill.key] ? 'touched' : ''}>
              <div>
                <span>{skill.title}</span>
                <p>{skill.why}</p>
              </div>
              <ul>
                <li><strong>Tiny:</strong> {skill.tiny}</li>
                <li><strong>Standard:</strong> {skill.standard}</li>
                <li><strong>Visible output:</strong> {skill.output}</li>
              </ul>
            </article>
          ))}
        </section>
      </details>

      <details className="hub-secondary-details iris365-archive-details">
        <summary>Proof archive &amp; recent entries</summary>

      <section className="iris365-recent-card">
        <div className="card-header">
          <div>
            <div className="section-label">Recent entries</div>
            <div className="card-title">Last 7 saved days</div>
          </div>
          <Leaf size={16} />
        </div>
        {recentEntries.length > 0 ? (
          <div className="iris365-recent-list">
            {recentEntries.map(item => {
              const score = calculateFoundationScore(item)
              const status = calculateFoundationStatus(item)
              const mainGrowthTask = getMainGrowthTask(item)
              return (
                <div key={item.date} className="iris365-recent-row">
                  <div>
                    <strong>{formatShortDate(item.date)} · Day {calculateCurrentDayNumber(IRIS_365_START_DATE, item.date)}</strong>
                    <small>{mainGrowthTask || item.tinyWin || 'Small daily proof logged.'}</small>
                    {item.tinyWin && mainGrowthTask && <small>Tiny win: {item.tinyWin}</small>}
                  </div>
                  <div className="iris365-recent-pills">
                    <span><CheckCircle2 size={12} /> {score} / 3</span>
                    <span>{status}</span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="iris365-empty-copy">No entries yet. Sleep, movement, or one real thing is enough to begin.</p>
        )}
      </section>

      <section className="iris365-proof-card">
        <div className="card-header">
          <div>
            <div className="section-label">Small evidence still counts</div>
            <div className="card-title">Proof I’m Not Stuck</div>
            <p className="iris365-proof-intro">Small visible evidence that I’m moving. 小证据，不是正式归档。</p>
          </div>
          <Plus size={16} />
        </div>
        <div className="iris365-proof-quick-chips" aria-label="Quick tiny proof ideas">
          {PROOF_QUICK_CHIPS.map(chip => (
            <button key={chip.label} type="button" onClick={() => applyProofChip(chip)}>
              {chip.label}
            </button>
          ))}
        </div>
        <div className="iris365-proof-form">
          <label className="iris365-proof-title-field">
            今天有什么小证据？
            <input
              value={proofDraft.title}
              onChange={event => setProofDraft({ ...proofDraft, title: event.target.value })}
              placeholder="今天有什么小证据？"
            />
          </label>
          <label className="iris365-proof-description">
            这说明我在哪方面有一点点进步？
            <textarea
              value={proofDraft.description}
              onChange={event => setProofDraft({ ...proofDraft, description: event.target.value })}
              placeholder="一句话就够：这说明我没有原地踏步。"
            />
          </label>
          <label className="iris365-proof-secondary-field">
            Category
            <select
              value={proofDraft.category}
              onChange={event => setProofDraft({ ...proofDraft, category: event.target.value as Iris365ProofCategory })}
            >
              {IRIS_365_PROOF_CATEGORIES.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
          <label className="iris365-proof-secondary-field">
            Optional link / file
            <input
              value={proofDraft.linkOrFile}
              onChange={event => setProofDraft({ ...proofDraft, linkOrFile: event.target.value })}
              placeholder="Optional URL, file path, repo, Notion page"
            />
          </label>
          <button type="button" className="btn btn-primary" onClick={saveProofItem}>
            Save tiny proof
          </button>
        </div>

        <div className="iris365-proof-filter">
          <button
            type="button"
            className={proofCategoryFilter === 'All' ? 'active' : ''}
            onClick={() => setProofCategoryFilter('All')}
          >
            All
          </button>
          {IRIS_365_PROOF_CATEGORIES.map(category => (
            <button
              key={category}
              type="button"
              className={proofCategoryFilter === category ? 'active' : ''}
              onClick={() => setProofCategoryFilter(category)}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="iris365-proof-list">
          {filteredProofItems.length > 0 ? filteredProofItems.map(item => (
            <article key={item.id} className="iris365-proof-item">
              <div>
                <span>{item.category} · {formatShortDate(item.date)}</span>
                <h3>{item.title}</h3>
                {item.description && <p>{item.description}</p>}
                {item.linkOrFile && <small>{item.linkOrFile}</small>}
              </div>
            </article>
          )) : (
            <p className="iris365-empty-copy">No tiny proof yet. One small sentence is enough when progress feels invisible.</p>
          )}
        </div>
      </section>
      </details>
    </div>
  )
}

interface Iris365HomeSummaryProps {
  onOpenIris365?: () => void
}

export function Iris365HomeSummary({ onOpenIris365 }: Iris365HomeSummaryProps = {}) {
  const today = getLocalDateKey()
  const store = loadIris365Store()
  const entry = loadIris365Entry(today, store)
  const dayNumber = calculateCurrentDayNumber(IRIS_365_START_DATE, today)
  const preStart = isBeforeIris365Start(today, IRIS_365_START_DATE)
  const phase = determineCurrentPhase(Math.max(1, dayNumber))
  const daysRemaining = calculateDaysRemaining(IRIS_365_START_DATE, today)

  return (
    <section className="iris365-home-card dopamine-home-card">
      <div>
        <div className="section-label">Low-stimulation redirect</div>
        <h3>Before I Spiral</h3>
        <p>AI 短剧、中文网文、小红书、查价格、merge game、睡前找东西看？先别开新坑。</p>
      </div>
      <button type="button" className="btn btn-primary dopamine-home-action" onClick={onOpenIris365}>
        救我10分钟
      </button>
      <strong>
        Comfort is allowed. 不戒快乐，只是先别把今晚交给算法。
      </strong>
      <small>
        {preStart
          ? 'Iris 365 starts tomorrow.'
          : `Iris 365 day ${dayNumber} / 365 · ${daysRemaining} days left · ${phase.title}`}
        {(entry.englishOutput || entry.oneRealThingDone || entry.bodyMoved) ? ' · proof started today' : ''}
      </small>
    </section>
  )
}
