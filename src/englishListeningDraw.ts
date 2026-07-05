import { getLocalDateKey } from './focus'
import type { StudyCategory, StudyEnergy } from './studyTypes'

export type EnglishListeningDrawMode = 'shadowing' | 'light-input'

export interface EnglishListeningDrawResult {
  id: string
  mode: EnglishListeningDrawMode
  material: string
  materialTitle: string
  sourceName: string
  suggestedWhereToOpen: string
  specificInstruction: string
  durationMinutes: 25 | 50
  title: string
  recommendedDuration: 25 | 50
  category: StudyCategory
  energy: StudyEnergy
  studyMethod: string
  subtasks: string[]
  countsAsEnglishOutputRep: boolean
  noteDestination: string
  resourceSuggestion: string
  source: 'english-listening-draw'
  createdAt: string
  startedSessionId?: string
}

export interface EnglishListeningDrawState {
  date: string
  redrawLimit: number
  redrawsUsed: number
  draws: EnglishListeningDrawResult[]
}

interface DrawMaterial {
  materialTitle: string
  sourceName: string
  suggestedWhereToOpen: string
  specificInstruction: string
  mode: EnglishListeningDrawMode
  priority: 'primary' | 'secondary'
  durationMinutes?: 25 | 50
}

const STORAGE_KEY = 'iris-english-listening-draw'
const DEFAULT_REDRAW_LIMIT = 2

export const ENGLISH_LISTENING_DRAW_MODES: EnglishListeningDrawMode[] = ['shadowing', 'light-input']

export const ENGLISH_LISTENING_DRAW_MODE_LABELS: Record<EnglishListeningDrawMode, string> = {
  shadowing: '精听 / Shadowing',
  'light-input': '泛听 / Light Input',
}

const LEGACY_MODE_MAP: Record<string, EnglishListeningDrawMode> = {
  'Intensive Listening / Shadowing': 'shadowing',
  'Australian English': 'shadowing',
  'Workplace English': 'shadowing',
  'Output Challenge': 'shadowing',
  'Low-energy Input': 'light-input',
  shadowing: 'shadowing',
  'light-input': 'light-input',
}

const DRAW_MATERIALS: DrawMaterial[] = [
  { mode: 'shadowing', sourceName: 'Gruen', suggestedWhereToOpen: 'ABC iview / YouTube clips / saved Gruen episode', materialTitle: 'Gruen — advertising discussion segment', specificInstruction: 'Open a Gruen advertising discussion segment and pick 3-5 minutes.', priority: 'primary' },
  { mode: 'shadowing', sourceName: 'Gruen', suggestedWhereToOpen: 'ABC iview / YouTube clips / saved Gruen episode', materialTitle: 'Gruen — panel reaction segment', specificInstruction: 'Open a Gruen panel reaction segment and shadow the most reusable reactions.', priority: 'primary' },
  { mode: 'shadowing', sourceName: 'Gruen', suggestedWhereToOpen: 'ABC iview / YouTube clips / saved Gruen episode', materialTitle: 'Gruen — consumer psychology explanation', specificInstruction: 'Open a Gruen consumer psychology explanation and summarise the main point.', priority: 'primary' },
  { mode: 'shadowing', sourceName: 'The Assembly', suggestedWhereToOpen: 'ABC iview / saved episode / clips', materialTitle: 'The Assembly — guest Q&A segment', specificInstruction: 'Open a gentle guest Q&A segment and notice tone, empathy, and answer structure.', priority: 'primary' },
  { mode: 'shadowing', sourceName: 'The Assembly', suggestedWhereToOpen: 'ABC iview / saved episode / clips', materialTitle: 'The Assembly — natural answer segment', specificInstruction: 'Open a natural answer segment and shadow 3-5 lines with calm rhythm.', priority: 'primary' },
  { mode: 'shadowing', sourceName: 'Utopia', suggestedWhereToOpen: 'ABC iview / Netflix / saved episode', materialTitle: 'Utopia — meeting scene', specificInstruction: 'Open a Utopia meeting scene and listen for softening, clarification, and admin phrasing.', priority: 'primary' },
  { mode: 'shadowing', sourceName: 'Utopia', suggestedWhereToOpen: 'ABC iview / Netflix / saved episode', materialTitle: 'Utopia — bureaucracy scene', specificInstruction: 'Open a bureaucracy scene and save 3 workplace/admin expressions.', priority: 'primary' },
  { mode: 'shadowing', sourceName: 'Utopia', suggestedWhereToOpen: 'ABC iview / Netflix / saved episode', materialTitle: 'Utopia — workplace clarification scene', specificInstruction: 'Open a workplace clarification scene and rewrite 2 lines for a student-service context.', priority: 'primary' },
  { mode: 'shadowing', sourceName: 'Fisk', suggestedWhereToOpen: 'ABC iview / Netflix / saved episode', materialTitle: 'Fisk — office scene', specificInstruction: 'Open a Fisk office scene and shadow the low-angst workplace phrasing.', priority: 'primary' },
  { mode: 'shadowing', sourceName: 'Fisk', suggestedWhereToOpen: 'ABC iview / Netflix / saved episode', materialTitle: 'Fisk — client conversation scene', specificInstruction: 'Open a Fisk client conversation and listen for legal/admin everyday English.', priority: 'primary' },
  { mode: 'shadowing', sourceName: 'Rosehaven', suggestedWhereToOpen: 'ABC iview / saved episode', materialTitle: 'Rosehaven — casual conversation scene', specificInstruction: 'Open a warm Rosehaven conversation and shadow natural daily rhythm.', priority: 'primary' },
  { mode: 'shadowing', sourceName: 'Rosehaven', suggestedWhereToOpen: 'ABC iview / saved episode', materialTitle: 'Rosehaven — friendship conversation scene', specificInstruction: 'Open a friendship conversation and save gentle reaction phrases.', priority: 'primary' },
  { mode: 'shadowing', sourceName: 'Upper Middle Bogan', suggestedWhereToOpen: 'ABC iview / saved episode', materialTitle: 'Upper Middle Bogan — family conversation scene', specificInstruction: 'Open a family conversation scene and listen for Melbourne daily English rhythm.', priority: 'primary' },
  { mode: 'shadowing', sourceName: 'Upper Middle Bogan', suggestedWhereToOpen: 'ABC iview / saved episode', materialTitle: 'Upper Middle Bogan — Melbourne daily English scene', specificInstruction: 'Open a Melbourne daily English scene and shadow 3-5 short lines.', priority: 'primary' },
  { mode: 'shadowing', sourceName: 'Have You Been Paying Attention?', suggestedWhereToOpen: '10 Play / YouTube clips / saved episode', materialTitle: 'HYBPA — panel reaction segment', specificInstruction: 'Open a HYBPA panel reaction segment and save useful reaction phrases.', priority: 'primary' },
  { mode: 'shadowing', sourceName: 'Have You Been Paying Attention?', suggestedWhereToOpen: '10 Play / YouTube clips / saved episode', materialTitle: 'HYBPA — light news discussion segment', specificInstruction: 'Open a light news discussion segment and shadow short reactions.', priority: 'primary' },
  { mode: 'shadowing', sourceName: 'The Cheap Seats', suggestedWhereToOpen: '10 Play / YouTube clips / saved episode', materialTitle: 'The Cheap Seats — light news segment', specificInstruction: 'Open a light news segment and collect natural Aussie reactions.', priority: 'primary' },
  { mode: 'shadowing', sourceName: 'The Cheap Seats', suggestedWhereToOpen: '10 Play / YouTube clips / saved episode', materialTitle: 'The Cheap Seats — reaction segment', specificInstruction: 'Open a reaction segment and shadow playful delivery.', priority: 'primary' },
  { mode: 'shadowing', sourceName: "Thank God You're Here", suggestedWhereToOpen: '10 Play / YouTube clips / saved episode', materialTitle: "Thank God You're Here — improv entrance scene", specificInstruction: 'Open an improv entrance scene and notice quick reactions.', priority: 'primary' },
  { mode: 'shadowing', sourceName: "Thank God You're Here", suggestedWhereToOpen: '10 Play / YouTube clips / saved episode', materialTitle: "Thank God You're Here — quick reaction segment", specificInstruction: 'Open a quick reaction segment and practise 3 short responses.', priority: 'primary' },
  { mode: 'shadowing', sourceName: 'Holmesglen roleplay bank', suggestedWhereToOpen: 'Saved Holmesglen/student-service roleplay notes', materialTitle: 'Holmesglen — student service roleplay', specificInstruction: 'Open a saved student-service roleplay and practise one clear answer.', priority: 'primary' },
  { mode: 'shadowing', sourceName: 'Campus admin roleplay bank', suggestedWhereToOpen: 'Saved campus/admin English notes', materialTitle: 'Campus admin — direction explanation roleplay', specificInstruction: 'Open a campus direction roleplay and practise giving clear directions.', priority: 'primary' },
  { mode: 'shadowing', sourceName: 'Event check-in roleplay bank', suggestedWhereToOpen: 'Saved event/admin English notes', materialTitle: 'Event check-in — student welcome roleplay', specificInstruction: 'Open an event check-in roleplay and practise polite admin phrasing.', priority: 'primary' },
  { mode: 'shadowing', sourceName: 'WorkLife with Adam Grant', suggestedWhereToOpen: 'Podcast app / transcript / TED website', materialTitle: 'WorkLife — workplace psychology segment', specificInstruction: 'Open a WorkLife workplace psychology segment and speak a 3-sentence summary.', priority: 'secondary' },
  { mode: 'shadowing', sourceName: 'WorkLife with Adam Grant', suggestedWhereToOpen: 'Podcast app / transcript / TED website', materialTitle: 'WorkLife — recharging / productivity segment', specificInstruction: 'Open a WorkLife productivity segment and save thoughtful workplace vocabulary.', priority: 'secondary' },
  { mode: 'shadowing', sourceName: 'No Stupid Questions', suggestedWhereToOpen: 'Podcast app / transcript', materialTitle: 'No Stupid Questions — psychology / behaviour segment', specificInstruction: 'Open a psychology or behaviour segment and summarise the reasoning.', priority: 'secondary' },
  { mode: 'shadowing', sourceName: "Luke's English Podcast", suggestedWhereToOpen: "Podcast app / Luke's English Podcast website", materialTitle: "Luke's English Podcast — explanation segment", specificInstruction: 'Open an explanation segment and shadow natural explanatory rhythm.', priority: 'secondary' },
  { mode: 'shadowing', sourceName: 'Coursera AI Pathway', suggestedWhereToOpen: 'Coursera current AI course', materialTitle: 'Coursera AI Pathway — AI agents explanation', specificInstruction: 'Open the current AI course and explain one AI agent concept in simple English.', priority: 'secondary' },
  { mode: 'shadowing', sourceName: 'TED / WorkLife-style workplace psychology clip', suggestedWhereToOpen: 'TED website / saved workplace psychology clip', materialTitle: 'TED / WorkLife-style — workplace psychology clip', specificInstruction: 'Open a workplace psychology clip and save 3 useful expressions.', priority: 'secondary' },

  { mode: 'light-input', sourceName: 'Rosehaven', suggestedWhereToOpen: 'ABC iview / saved episode', materialTitle: 'Rosehaven — casual episode', specificInstruction: 'Open a casual Rosehaven episode and keep it gentle.', priority: 'primary' },
  { mode: 'light-input', sourceName: 'Fisk', suggestedWhereToOpen: 'ABC iview / Netflix / saved episode', materialTitle: 'Fisk — casual episode', specificInstruction: 'Open a casual Fisk episode and notice 1-3 useful phrases.', priority: 'primary' },
  { mode: 'light-input', sourceName: 'Utopia', suggestedWhereToOpen: 'ABC iview / Netflix / saved episode', materialTitle: 'Utopia — light scene', specificInstruction: 'Open a light Utopia scene and keep it as easy input.', priority: 'primary' },
  { mode: 'light-input', sourceName: 'Gruen', suggestedWhereToOpen: 'ABC iview / YouTube clips / saved Gruen episode', materialTitle: 'Gruen — casual segment', specificInstruction: 'Open a casual Gruen segment without heavy note-taking.', priority: 'primary' },
  { mode: 'light-input', sourceName: 'The Assembly', suggestedWhereToOpen: 'ABC iview / saved episode / clips', materialTitle: 'The Assembly — casual segment', specificInstruction: 'Open a gentle Assembly segment and stay with the English environment.', priority: 'primary' },
  { mode: 'light-input', sourceName: 'Have You Been Paying Attention?', suggestedWhereToOpen: '10 Play / YouTube clips / saved episode', materialTitle: 'HYBPA — light segment', specificInstruction: 'Open a light HYBPA segment and enjoy the rhythm.', priority: 'primary' },
  { mode: 'light-input', sourceName: 'The Cheap Seats', suggestedWhereToOpen: '10 Play / YouTube clips / saved episode', materialTitle: 'The Cheap Seats — light segment', specificInstruction: 'Open a light segment and save only phrases that naturally jump out.', priority: 'primary' },
  { mode: 'light-input', sourceName: "Luke's English Podcast", suggestedWhereToOpen: "Podcast app / Luke's English Podcast website", materialTitle: "Luke's English Podcast — easy episode", specificInstruction: 'Open an easy episode and listen without pressure.', priority: 'primary' },
  { mode: 'light-input', sourceName: 'Saved audiobook shelf', suggestedWhereToOpen: 'Libby / Audible / saved audiobook app', materialTitle: 'Easy audiobook — gentle chapter', specificInstruction: 'Open an easy audiobook chapter and listen for comfort.', priority: 'primary' },
  { mode: 'light-input', sourceName: 'M/M audiobook shelf', suggestedWhereToOpen: 'Libby / Audible / saved audiobook app', materialTitle: 'M/M audiobook — gentle chapter', specificInstruction: 'Open a low-angst M/M audiobook chapter and keep it recovery-friendly.', priority: 'primary' },
  { mode: 'light-input', sourceName: 'Puckboy / Eden Finley / Saxon James audiobook shelf', suggestedWhereToOpen: 'Libby / Audible / saved audiobook app', materialTitle: 'Puckboy / Eden Finley / Saxon James — light chapter', specificInstruction: 'Open a familiar light chapter and stay in English gently.', priority: 'primary' },
  { mode: 'light-input', sourceName: 'Libby audiobook shelf', suggestedWhereToOpen: 'Libby app', materialTitle: 'Libby audiobook — easy chapter', specificInstruction: 'Open an easy Libby chapter and save only natural phrases.', priority: 'primary' },
]

function emptyState(date = getLocalDateKey()): EnglishListeningDrawState {
  return {
    date,
    redrawLimit: DEFAULT_REDRAW_LIMIT,
    redrawsUsed: 0,
    draws: [],
  }
}

function normaliseMode(value: unknown): EnglishListeningDrawMode {
  return typeof value === 'string' && LEGACY_MODE_MAP[value] ? LEGACY_MODE_MAP[value] : 'shadowing'
}

function normaliseDraw(value: Partial<EnglishListeningDrawResult>): EnglishListeningDrawResult | null {
  if (!value.id || !value.material || !value.title || !value.createdAt) return null
  const mode = normaliseMode(value.mode)
  const legacyMaterial: DrawMaterial = {
    mode,
    materialTitle: value.materialTitle ?? value.title ?? value.material,
    sourceName: value.sourceName ?? value.material,
    suggestedWhereToOpen: value.suggestedWhereToOpen ?? 'Saved material / app where this source lives',
    specificInstruction: value.specificInstruction ?? `Open ${value.materialTitle ?? value.material} and pick a short, useful segment.`,
    priority: 'primary',
    durationMinutes: value.durationMinutes ?? value.recommendedDuration,
  }
  const template = resultTemplate(legacyMaterial)
  return {
    ...template,
    id: value.id,
    mode,
    material: template.materialTitle,
    title: value.title === value.material ? template.title : value.title,
    source: 'english-listening-draw',
    createdAt: value.createdAt,
    startedSessionId: value.startedSessionId,
  }
}

function parseState(value: string | null): EnglishListeningDrawState {
  if (!value) return emptyState()
  try {
    const parsed = JSON.parse(value) as Partial<EnglishListeningDrawState>
    if (parsed.date !== getLocalDateKey()) return emptyState()
    return {
      date: parsed.date,
      redrawLimit: typeof parsed.redrawLimit === 'number' ? parsed.redrawLimit : DEFAULT_REDRAW_LIMIT,
      redrawsUsed: typeof parsed.redrawsUsed === 'number' ? parsed.redrawsUsed : 0,
      draws: Array.isArray(parsed.draws)
        ? parsed.draws.map(draw => normaliseDraw(draw)).filter((draw): draw is EnglishListeningDrawResult => Boolean(draw))
        : [],
    }
  } catch {
    return emptyState()
  }
}

export function loadEnglishListeningDrawState(): EnglishListeningDrawState {
  if (typeof localStorage === 'undefined') return emptyState()
  const state = parseState(localStorage.getItem(STORAGE_KEY))
  saveEnglishListeningDrawState(state)
  return state
}

export function saveEnglishListeningDrawState(state: EnglishListeningDrawState): EnglishListeningDrawState {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }
  return state
}

export function englishListeningDrawModeLabel(mode: EnglishListeningDrawMode): string {
  return ENGLISH_LISTENING_DRAW_MODE_LABELS[mode]
}

function resultTemplate(
  material: DrawMaterial,
): Omit<EnglishListeningDrawResult, 'id' | 'mode' | 'createdAt' | 'startedSessionId' | 'source'> {
  const duration = material.durationMinutes ?? 25
  if (material.mode === 'light-input') {
    return {
      material: material.materialTitle,
      materialTitle: material.materialTitle,
      sourceName: material.sourceName,
      suggestedWhereToOpen: material.suggestedWhereToOpen,
      specificInstruction: material.specificInstruction,
      durationMinutes: duration,
      title: material.materialTitle,
      recommendedDuration: duration,
      category: 'English Input',
      energy: 'low',
      studyMethod: '打开抽到的具体材料。听一集或一个轻松片段。不暂停也可以，先保持英语环境。只保存自然跳出来的 1-3 个表达。如果状态好，最后用英文说 1 句 summary。',
      subtasks: [
        material.specificInstruction,
        '听一集或一个轻松片段',
        '不暂停也可以，先保持英语环境',
        '只保存自然跳出来的 1-3 个表达',
        '如果状态好，最后用英文说 1 句 summary',
      ],
      countsAsEnglishOutputRep: false,
      noteDestination: '01 English 英语/Input 泛听/',
      resourceSuggestion: `${material.sourceName} · ${material.suggestedWhereToOpen}`,
    }
  }

  return {
    material: material.materialTitle,
    materialTitle: material.materialTitle,
    sourceName: material.sourceName,
    suggestedWhereToOpen: material.suggestedWhereToOpen,
    specificInstruction: material.specificInstruction,
    durationMinutes: duration,
    title: material.materialTitle,
    recommendedDuration: duration,
    category: 'English Output',
    energy: 'medium',
    studyMethod: '打开抽到的具体材料。选 3-5 分钟片段。先听一遍，只抓主旨。Shadow 一小段，1-3 轮即可。录一次或口头复述 3 句。保存 3 个可复用表达。',
    subtasks: [
      material.specificInstruction,
      '选 3-5 分钟片段',
      '先听一遍，只抓主旨',
      'Shadow 一小段，1-3 轮即可',
      '录一次或口头复述 3 句',
      '保存 3 个可复用表达',
    ],
    countsAsEnglishOutputRep: true,
    noteDestination: '01 English 英语/Shadowing 跟读/',
    resourceSuggestion: `${material.sourceName} · ${material.suggestedWhereToOpen}`,
  }
}

function pickMaterial(mode: EnglishListeningDrawMode, previousMaterials: Set<string>): DrawMaterial {
  const materials = DRAW_MATERIALS.filter(item => item.mode === mode)
  const primary = materials.filter(item => item.priority === 'primary')
  const freshPrimary = primary.filter(item => !previousMaterials.has(item.materialTitle))
  const freshAll = materials.filter(item => !previousMaterials.has(item.materialTitle))
  const pool = freshPrimary.length > 0 ? freshPrimary : freshAll.length > 0 ? freshAll : materials
  return pool[Math.floor(Math.random() * pool.length)] ?? materials[0]
}

export function drawEnglishListeningMaterial(
  mode: EnglishListeningDrawMode,
  state = loadEnglishListeningDrawState(),
): EnglishListeningDrawState {
  const nextMode = normaliseMode(mode)
  const previousMaterials = new Set(state.draws.map(draw => draw.material))
  const material = pickMaterial(nextMode, previousMaterials)
  const result: EnglishListeningDrawResult = {
    id: crypto.randomUUID(),
    mode: nextMode,
    ...resultTemplate(material),
    source: 'english-listening-draw',
    createdAt: new Date().toISOString(),
  }
  return saveEnglishListeningDrawState({
    ...state,
    draws: [...state.draws, result],
  })
}

export function redrawEnglishListeningMaterial(
  mode: EnglishListeningDrawMode,
  state = loadEnglishListeningDrawState(),
): EnglishListeningDrawState {
  if (state.draws.length > 0 && state.redrawsUsed >= state.redrawLimit) return state
  return drawEnglishListeningMaterial(mode, {
    ...state,
    redrawsUsed: state.draws.length > 0 ? state.redrawsUsed + 1 : state.redrawsUsed,
  })
}

export function markEnglishListeningDrawStarted(
  drawId: string,
  sessionId: string,
  state = loadEnglishListeningDrawState(),
): EnglishListeningDrawState {
  return saveEnglishListeningDrawState({
    ...state,
    draws: state.draws.map(draw => draw.id === drawId ? { ...draw, startedSessionId: sessionId } : draw),
  })
}

export function latestEnglishListeningDraw(state: EnglishListeningDrawState): EnglishListeningDrawResult | null {
  return state.draws[state.draws.length - 1] ?? null
}

export function englishListeningDrawNotePrompt(draw: EnglishListeningDrawResult, date = getLocalDateKey()): string {
  return [
    `# 今日英语抽签 - ${date}`,
    '',
    '## 抽到的材料',
    `- 材料：${draw.materialTitle}`,
    `- 来源：${draw.sourceName}`,
    `- 去哪里打开：${draw.suggestedWhereToOpen}`,
    `- 模式：${englishListeningDrawModeLabel(draw.mode)}`,
    `- 推荐时长：${draw.recommendedDuration} min`,
    `- 是否可算 English Output Rep：${draw.countsAsEnglishOutputRep ? '可以，完成 speaking / recording / oral summary 时计入' : '默认不算，除非额外加 speaking / writing output'}`,
    '',
    '## 做法',
    ...draw.subtasks.map((subtask, index) => `${index + 1}. ${subtask}`),
    '',
    '## 今日可保留表达',
    '- ',
    '- ',
    '- ',
    '',
    '## 我的输出 / 一句话总结',
    '- ',
    '',
    '## 下次可以继续',
    '- ',
  ].join('\n')
}
