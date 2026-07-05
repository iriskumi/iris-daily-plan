import { getLocalDateKey } from './focus'
import type { StudyCategory, StudyEnergy } from './studyTypes'

export type EnglishListeningDrawMode = 'shadowing' | 'light-input'

export interface EnglishListeningDrawResult {
  id: string
  mode: EnglishListeningDrawMode
  material: string
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
  material: string
  mode: EnglishListeningDrawMode
  priority: 'primary' | 'secondary'
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
  { mode: 'shadowing', material: 'Gruen', priority: 'primary' },
  { mode: 'shadowing', material: 'The Assembly', priority: 'primary' },
  { mode: 'shadowing', material: 'Utopia', priority: 'primary' },
  { mode: 'shadowing', material: 'Fisk', priority: 'primary' },
  { mode: 'shadowing', material: 'Rosehaven', priority: 'primary' },
  { mode: 'shadowing', material: 'Upper Middle Bogan', priority: 'primary' },
  { mode: 'shadowing', material: 'Have You Been Paying Attention?', priority: 'primary' },
  { mode: 'shadowing', material: 'The Cheap Seats', priority: 'primary' },
  { mode: 'shadowing', material: "Thank God You're Here", priority: 'primary' },
  { mode: 'shadowing', material: 'Australian workplace / admin explainer clip', priority: 'primary' },
  { mode: 'shadowing', material: 'Australian interview / workplace conversation clip', priority: 'primary' },
  { mode: 'shadowing', material: 'Holmesglen student service roleplay', priority: 'primary' },
  { mode: 'shadowing', material: 'Campus direction explanation', priority: 'primary' },
  { mode: 'shadowing', material: 'Event check-in explanation', priority: 'primary' },
  { mode: 'shadowing', material: 'WorkLife with Adam Grant', priority: 'secondary' },
  { mode: 'shadowing', material: 'No Stupid Questions', priority: 'secondary' },
  { mode: 'shadowing', material: "Luke's English Podcast", priority: 'secondary' },
  { mode: 'shadowing', material: 'Coursera AI concept explanation', priority: 'secondary' },
  { mode: 'shadowing', material: 'TED / WorkLife-style workplace psychology clip', priority: 'secondary' },

  { mode: 'light-input', material: 'Easy audiobook', priority: 'primary' },
  { mode: 'light-input', material: 'M/M audiobook', priority: 'primary' },
  { mode: 'light-input', material: 'Puckboy / Eden Finley / Saxon James audiobook', priority: 'primary' },
  { mode: 'light-input', material: 'Libby audiobook', priority: 'primary' },
  { mode: 'light-input', material: 'Light Australian TV episode', priority: 'primary' },
  { mode: 'light-input', material: 'Rosehaven casual episode', priority: 'primary' },
  { mode: 'light-input', material: 'Fisk casual episode', priority: 'primary' },
  { mode: 'light-input', material: 'Utopia casual scene', priority: 'primary' },
  { mode: 'light-input', material: 'Gruen casual segment', priority: 'primary' },
  { mode: 'light-input', material: 'The Assembly casual segment', priority: 'primary' },
  { mode: 'light-input', material: 'Light podcast episode', priority: 'primary' },
  { mode: 'light-input', material: "Luke's English Podcast easy episode", priority: 'primary' },
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
  const template = resultTemplate(mode, value.material)
  return {
    ...template,
    id: value.id,
    mode,
    material: value.material,
    title: value.title,
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
  mode: EnglishListeningDrawMode,
  material: string,
): Omit<EnglishListeningDrawResult, 'id' | 'mode' | 'material' | 'createdAt' | 'startedSessionId' | 'source'> {
  if (mode === 'light-input') {
    return {
      title: `今日泛听签：${material}`,
      recommendedDuration: 25,
      category: 'English Input',
      energy: 'low',
      studyMethod: '选一集或一个轻松片段。不暂停也可以，先保持英语环境。只保存自然跳出来的 1-3 个表达。如果状态好，最后用英文说 1 句 summary。',
      subtasks: [
        '选一集或一个轻松片段',
        '不暂停也可以，先保持英语环境',
        '只保存自然跳出来的 1-3 个表达',
        '如果状态好，最后用英文说 1 句 summary',
      ],
      countsAsEnglishOutputRep: false,
      noteDestination: '01 English 英语/Input 泛听/',
      resourceSuggestion: material,
    }
  }

  return {
    title: `今日精听签：${material}`,
    recommendedDuration: 25,
    category: 'English Output',
    energy: 'medium',
    studyMethod: '选 3-5 分钟片段。先听一遍，只抓主旨。Shadow 一小段，1-3 轮即可。录一次或口头复述 3 句。保存 3 个可复用表达。',
    subtasks: [
      '选 3-5 分钟片段',
      '先听一遍，只抓主旨',
      'Shadow 一小段，1-3 轮即可',
      '录一次或口头复述 3 句',
      '保存 3 个可复用表达',
    ],
    countsAsEnglishOutputRep: true,
    noteDestination: '01 English 英语/Shadowing 跟读/',
    resourceSuggestion: material,
  }
}

function pickMaterial(mode: EnglishListeningDrawMode, previousMaterials: Set<string>): DrawMaterial {
  const materials = DRAW_MATERIALS.filter(item => item.mode === mode)
  const primary = materials.filter(item => item.priority === 'primary')
  const freshPrimary = primary.filter(item => !previousMaterials.has(item.material))
  const freshAll = materials.filter(item => !previousMaterials.has(item.material))
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
    material: material.material,
    ...resultTemplate(nextMode, material.material),
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
    `- 模式：${englishListeningDrawModeLabel(draw.mode)}`,
    `- 材料：${draw.material}`,
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
