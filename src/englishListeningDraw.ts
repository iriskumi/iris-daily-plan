import { getLocalDateKey } from './focus'
import type { StudyCategory, StudyEnergy } from './studyTypes'

export type EnglishListeningDrawMode =
  | 'Intensive Listening / Shadowing'
  | 'Low-energy Input'
  | 'Workplace English'
  | 'Output Challenge'
  | 'Australian English'

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
  template: 'podcast' | 'australian-workplace' | 'australian-panel' | 'sitcom' | 'coursera-ai' | 'low-energy' | 'workplace' | 'output'
}

const STORAGE_KEY = 'iris-english-listening-draw'
const DEFAULT_REDRAW_LIMIT = 2

export const ENGLISH_LISTENING_DRAW_MODES: EnglishListeningDrawMode[] = [
  'Intensive Listening / Shadowing',
  'Low-energy Input',
  'Workplace English',
  'Output Challenge',
  'Australian English',
]

const DRAW_MATERIALS: DrawMaterial[] = [
  { mode: 'Intensive Listening / Shadowing', material: 'WorkLife with Adam Grant', template: 'podcast' },
  { mode: 'Intensive Listening / Shadowing', material: 'No Stupid Questions', template: 'podcast' },
  { mode: 'Intensive Listening / Shadowing', material: "Luke's English Podcast", template: 'podcast' },
  { mode: 'Intensive Listening / Shadowing', material: 'The Assembly', template: 'podcast' },
  { mode: 'Intensive Listening / Shadowing', material: 'Gruen', template: 'podcast' },
  { mode: 'Intensive Listening / Shadowing', material: 'Utopia scene', template: 'australian-workplace' },
  { mode: 'Intensive Listening / Shadowing', material: 'Fisk scene', template: 'australian-workplace' },
  { mode: 'Intensive Listening / Shadowing', material: 'Rosehaven scene', template: 'australian-workplace' },
  { mode: 'Intensive Listening / Shadowing', material: 'Upper Middle Bogan scene', template: 'australian-workplace' },
  { mode: 'Intensive Listening / Shadowing', material: 'Modern Family scene', template: 'sitcom' },
  { mode: 'Intensive Listening / Shadowing', material: 'Brooklyn Nine-Nine scene', template: 'sitcom' },
  { mode: 'Intensive Listening / Shadowing', material: 'Australian workplace / admin explainer clip', template: 'australian-workplace' },
  { mode: 'Intensive Listening / Shadowing', material: 'Coursera AI concept explanation', template: 'coursera-ai' },
  { mode: 'Intensive Listening / Shadowing', material: 'TED / WorkLife-style workplace psychology clip', template: 'podcast' },

  { mode: 'Australian English', material: 'Gruen', template: 'australian-panel' },
  { mode: 'Australian English', material: 'The Assembly', template: 'podcast' },
  { mode: 'Australian English', material: 'Utopia', template: 'australian-workplace' },
  { mode: 'Australian English', material: 'Fisk', template: 'australian-workplace' },
  { mode: 'Australian English', material: 'Rosehaven', template: 'australian-workplace' },
  { mode: 'Australian English', material: 'Upper Middle Bogan', template: 'australian-workplace' },
  { mode: 'Australian English', material: 'Kath & Kim', template: 'australian-panel' },
  { mode: 'Australian English', material: 'Have You Been Paying Attention?', template: 'australian-panel' },
  { mode: 'Australian English', material: 'The Cheap Seats', template: 'australian-panel' },
  { mode: 'Australian English', material: "Thank God You're Here", template: 'australian-panel' },
  { mode: 'Australian English', material: 'Australian workplace / admin explainer clip', template: 'australian-workplace' },

  { mode: 'Low-energy Input', material: 'Easy audiobook', template: 'low-energy' },
  { mode: 'Low-energy Input', material: 'M/M audiobook', template: 'low-energy' },
  { mode: 'Low-energy Input', material: 'Puckboy / Eden Finley / Saxon James audiobook', template: 'low-energy' },
  { mode: 'Low-energy Input', material: 'Libby audiobook', template: 'low-energy' },
  { mode: 'Low-energy Input', material: 'Light TV episode', template: 'low-energy' },
  { mode: 'Low-energy Input', material: 'Rosehaven casual scene', template: 'low-energy' },
  { mode: 'Low-energy Input', material: 'Fisk casual scene', template: 'low-energy' },
  { mode: 'Low-energy Input', material: 'Modern Family scene', template: 'low-energy' },
  { mode: 'Low-energy Input', material: 'Brooklyn Nine-Nine scene', template: 'low-energy' },
  { mode: 'Low-energy Input', material: 'Low-pressure podcast episode', template: 'low-energy' },

  { mode: 'Workplace English', material: 'Holmesglen student service roleplay', template: 'workplace' },
  { mode: 'Workplace English', material: 'Campus direction explanation', template: 'workplace' },
  { mode: 'Workplace English', material: 'Event check-in explanation', template: 'workplace' },
  { mode: 'Workplace English', material: 'Email reply practice', template: 'workplace' },
  { mode: 'Workplace English', material: 'Asking a colleague a question', template: 'workplace' },
  { mode: 'Workplace English', material: 'Explaining a policy or process simply', template: 'workplace' },
  { mode: 'Workplace English', material: 'Utopia workplace/admin scene', template: 'australian-workplace' },
  { mode: 'Workplace English', material: 'Fisk workplace scene', template: 'australian-workplace' },
  { mode: 'Workplace English', material: 'Australian workplace / admin explainer clip', template: 'australian-workplace' },

  { mode: 'Output Challenge', material: '1-minute oral summary', template: 'output' },
  { mode: 'Output Challenge', material: '3-sentence opinion', template: 'output' },
  { mode: 'Output Challenge', material: 'Interview answer practice', template: 'output' },
  { mode: 'Output Challenge', material: "Explain today's Coursera concept", template: 'coursera-ai' },
  { mode: 'Output Challenge', material: 'Reuse 5 expressions from Expression Review Hub', template: 'output' },
  { mode: 'Output Challenge', material: 'Record and improve one answer', template: 'output' },
  { mode: 'Output Challenge', material: 'Explain my Daily Hub / Obsidian / Notion system in English', template: 'output' },
  { mode: 'Output Challenge', material: 'Explain my AI + cyber foundation positioning in English', template: 'output' },
]

function emptyState(date = getLocalDateKey()): EnglishListeningDrawState {
  return {
    date,
    redrawLimit: DEFAULT_REDRAW_LIMIT,
    redrawsUsed: 0,
    draws: [],
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
      draws: Array.isArray(parsed.draws) ? parsed.draws as EnglishListeningDrawResult[] : [],
    }
  } catch {
    return emptyState()
  }
}

export function loadEnglishListeningDrawState(): EnglishListeningDrawState {
  if (typeof localStorage === 'undefined') return emptyState()
  return parseState(localStorage.getItem(STORAGE_KEY))
}

export function saveEnglishListeningDrawState(state: EnglishListeningDrawState): EnglishListeningDrawState {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }
  return state
}

function methodFor(material: DrawMaterial): Omit<EnglishListeningDrawResult, 'id' | 'mode' | 'material' | 'createdAt' | 'startedSessionId' | 'source'> {
  switch (material.template) {
    case 'podcast':
      return {
        title: `Shadowing draw: ${material.material}`,
        recommendedDuration: 25,
        category: 'English Output',
        energy: 'medium',
        studyMethod: 'Pick a 3-5 minute segment. Listen once for the main idea. Shadow one short section. Speak a 3-sentence summary. Save 3 useful expressions.',
        subtasks: ['Pick a 3-5 minute segment', 'Listen once for the main idea', 'Shadow one short section', 'Speak a 3-sentence summary', 'Save 3 useful expressions'],
        countsAsEnglishOutputRep: true,
        noteDestination: '01 English 英语/Shadowing 跟读/',
        resourceSuggestion: material.material,
      }
    case 'australian-workplace':
      return {
        title: `Aussie workplace draw: ${material.material}`,
        recommendedDuration: 25,
        category: 'English Output',
        energy: 'medium',
        studyMethod: 'Pick one short scene. Notice requests, softening language, disagreement, clarification, or workplace phrasing. Shadow 5-8 useful lines. Rewrite 3 lines for Holmesglen, student-service, or admin context. Save 3 expressions.',
        subtasks: ['Pick one short scene', 'Notice softening, clarification, or workplace phrasing', 'Shadow 5-8 useful lines', 'Rewrite 3 lines for Holmesglen/admin context', 'Save 3 expressions'],
        countsAsEnglishOutputRep: true,
        noteDestination: '01 English 英语/Workplace English 职场英语/',
        resourceSuggestion: material.material,
      }
    case 'australian-panel':
      return {
        title: `Australian English draw: ${material.material}`,
        recommendedDuration: 25,
        category: 'English Output',
        energy: 'low',
        studyMethod: 'Pick one short segment. Listen for reactions, humour, and natural phrasing. Shadow 3-5 short lines. Write down 3 useful reaction phrases. Use 2 of them in your own sentences.',
        subtasks: ['Pick one short segment', 'Listen for reactions and natural phrasing', 'Shadow 3-5 short lines', 'Save 3 reaction phrases', 'Use 2 in original sentences'],
        countsAsEnglishOutputRep: true,
        noteDestination: '01 English 英语/Australian English 澳洲英语/',
        resourceSuggestion: material.material,
      }
    case 'sitcom':
      return {
        title: `Casual English draw: ${material.material}`,
        recommendedDuration: 25,
        category: 'English Output',
        energy: 'low',
        studyMethod: 'Pick one short scene. Shadow lines with natural rhythm. Save casual expressions or reactions. Create 3 original sentences using the expressions.',
        subtasks: ['Pick one short scene', 'Shadow lines with natural rhythm', 'Save casual expressions or reactions', 'Create 3 original sentences'],
        countsAsEnglishOutputRep: true,
        noteDestination: '01 English 英语/Expressions 表达/',
        resourceSuggestion: material.material,
      }
    case 'coursera-ai':
      return {
        title: `AI explanation draw: ${material.material}`,
        recommendedDuration: 25,
        category: 'English Output',
        energy: 'medium',
        studyMethod: 'Pick one short concept explanation. Listen or read once. Explain the concept out loud in simple English. Save one portfolio/use-case idea. Write one sentence connecting it to Daily Hub, workflow automation, or cyber/security awareness.',
        subtasks: ['Pick one short concept explanation', 'Listen or read once', 'Explain it out loud in simple English', 'Save one portfolio/use-case idea', 'Connect it to Daily Hub, automation, or cyber'],
        countsAsEnglishOutputRep: true,
        noteDestination: '03 AI 人工智能/Coursera AI Pathway/Course Notes/',
        resourceSuggestion: material.material,
      }
    case 'low-energy':
      return {
        title: `Gentle input draw: ${material.material}`,
        recommendedDuration: 25,
        category: 'English Input',
        energy: 'low',
        studyMethod: 'Keep this recovery-friendly. Listen or watch lightly, then optionally add one tiny speaking or writing output step if you want it to count as output practice.',
        subtasks: ['Start the material gently', 'Notice 1-2 useful phrases only if they naturally stand out', 'Optional: speak or write one tiny output step'],
        countsAsEnglishOutputRep: false,
        noteDestination: '01 English 英语/Low Energy Input 低能量输入/',
        resourceSuggestion: material.material,
      }
    case 'workplace':
      return {
        title: `Workplace English draw: ${material.material}`,
        recommendedDuration: 25,
        category: 'English Output',
        energy: 'medium',
        studyMethod: 'Practise one practical workplace or student-service situation. Speak it once, improve the wording, then save the most reusable phrases.',
        subtasks: ['Set the situation', 'Speak one version out loud', 'Improve the wording', 'Save 3 reusable workplace phrases'],
        countsAsEnglishOutputRep: true,
        noteDestination: '01 English 英语/Workplace English 职场英语/',
        resourceSuggestion: material.material,
      }
    case 'output':
      return {
        title: `Output challenge draw: ${material.material}`,
        recommendedDuration: 25,
        category: 'English Output',
        energy: 'medium',
        studyMethod: 'Make one small piece of English output. Keep it short, concrete, and finishable. Record or write it, then improve one sentence.',
        subtasks: ['Create one short English output', 'Record or write it', 'Improve one sentence', 'Save 1-3 useful expressions'],
        countsAsEnglishOutputRep: true,
        noteDestination: '01 English 英语/Output 输出/',
        resourceSuggestion: material.material,
      }
  }
}

function pickMaterial(mode: EnglishListeningDrawMode, previousMaterials: Set<string>): DrawMaterial {
  const materials = DRAW_MATERIALS.filter(item => item.mode === mode)
  const fresh = materials.filter(item => !previousMaterials.has(item.material))
  const pool = fresh.length > 0 ? fresh : materials
  return pool[Math.floor(Math.random() * pool.length)] ?? materials[0]
}

export function drawEnglishListeningMaterial(
  mode: EnglishListeningDrawMode,
  state = loadEnglishListeningDrawState(),
): EnglishListeningDrawState {
  const previousMaterials = new Set(state.draws.map(draw => draw.material))
  const material = pickMaterial(mode, previousMaterials)
  const result: EnglishListeningDrawResult = {
    id: crypto.randomUUID(),
    mode,
    material: material.material,
    ...methodFor(material),
    source: 'english-listening-draw',
    createdAt: new Date().toISOString(),
  }
  const next = {
    ...state,
    draws: [...state.draws, result],
  }
  return saveEnglishListeningDrawState(next)
}

export function redrawEnglishListeningMaterial(
  mode: EnglishListeningDrawMode,
  state = loadEnglishListeningDrawState(),
): EnglishListeningDrawState {
  if (state.draws.length > 0 && state.redrawsUsed >= state.redrawLimit) return state
  const next = drawEnglishListeningMaterial(mode, {
    ...state,
    redrawsUsed: state.draws.length > 0 ? state.redrawsUsed + 1 : state.redrawsUsed,
  })
  return next
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
    `# English Listening Draw - ${date}`,
    '',
    '## Draw Result',
    `- Mode: ${draw.mode}`,
    `- Material: ${draw.material}`,
    `- Duration: ${draw.recommendedDuration} min`,
    `- Counts as English Output Rep: ${draw.countsAsEnglishOutputRep ? 'Yes, if completed with output' : 'No, unless I add speaking/writing output'}`,
    '',
    '## Method',
    ...draw.subtasks.map((subtask, index) => `${index + 1}. ${subtask}`),
    '',
    '## Useful Expressions',
    '- ',
    '- ',
    '- ',
    '',
    '## My Output',
    '- ',
    '',
    '## Next Time',
    '- ',
  ].join('\n')
}
