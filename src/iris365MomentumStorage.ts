import { getLocalDateKey } from './focus'

export interface Iris365MomentumEntry {
  date: string
  sleepRhythm: string
  movementDone: boolean
  studyDone: boolean
  englishOutputDone: boolean
  aiOrCourseraDone: boolean
  careerOrAdminDone: boolean
  mood: string
  smallestWin: string
  tomorrowRestartStep: string
  updatedAt: string
}

export interface Iris365MomentumStore {
  entries: Record<string, Iris365MomentumEntry>
}

const STORAGE_KEY = 'iris-365-log'
export const IRIS365_MOMENTUM_START_DATE = '2026-07-13'
export const IRIS365_MOMENTUM_END_DATE = '2027-07-12'

export const MONTHLY_MOMENTUM_PLAN: Record<string, { theme: string; focus: string[]; reminder: string }> = {
  '2026-07': {
    theme: '启动，不追求完美',
    focus: ['每天至少一个小动作', '建立 Daily Hub / Obsidian / Exercise 的使用节奏', '每天运动 10 分钟即可', 'Coursera AI Pathway 保持活跃'],
    reminder: '不要把 365 天的第一周搞成考试。先让系统跑起来。',
  },
  '2026-08': {
    theme: '稳定输出',
    focus: ['English Output Journey 开始稳定累积', '每周至少 5 次 English output rep', '运动开始恢复力量', 'Coursera 完成第一门或主要模块'],
    reminder: 'Input 可以轻松，output 才是体感变化的来源。',
  },
  '2026-09': {
    theme: 'AI 主线推进',
    focus: ['Coursera AI Pathway 到期前冲刺', '完成高价值课程 / certificate', '整理 1–2 个 portfolio ideas', 'Holmesglen Reserve 快走 60 分钟挑战'],
    reminder: '不要只刷课。每学一个概念，都想想可以怎么用在 Daily Hub / workflow / career。',
  },
  '2026-10': {
    theme: '身体和作品集',
    focus: ['学会一支新的 K-pop 舞蹈', '把 AI / Daily Hub 项目写成一篇 portfolio note', '准备 job/career packaging', 'English output 继续累积'],
    reminder: '作品集不是从零做大项目，而是把已经做过的东西讲清楚。',
  },
  '2026-11': {
    theme: '求职表达和速度',
    focus: ['CV / LinkedIn / interview answers', '5km 快走或跑走结合', '练 workplace English', '整理 cyber + AI foundation positioning'],
    reminder: '你不是只会一个方向。你的优势是 multilingual + admin + AI workflow + cyber foundation。',
  },
  '2026-12': {
    theme: '年末整合',
    focus: ['60–90 分钟户外活动', '整理今年完成的 proof', '回顾 English Output reps', '整理 Coursera / AI / Cyber / Career notes'],
    reminder: '12 月不是清算自己，而是看见证据。',
  },
  '2027-01': {
    theme: '重新启动',
    focus: ['年初恢复节奏', '每周 4 次活动', '重新校准 Study Dashboard', '保留最有效的系统'],
    reminder: '节奏断了也不代表失败。重新开始就是系统的一部分。',
  },
  '2027-02': {
    theme: '力量稳定',
    focus: ['每周 2 次力量训练', 'English output 保持', 'Job/Career 材料更新', 'AI 项目小修小补'],
    reminder: '身体力量和生活掌控感是连在一起的。',
  },
  '2027-03': {
    theme: '心肺稳定',
    focus: ['每周一次跑走结合', 'Coursera / AI notes 复盘', '更新 portfolio / GitHub / LinkedIn', '面试回答练习'],
    reminder: '你要的是可持续的精力，不是短期爆发。',
  },
  '2027-04': {
    theme: '舞蹈和表达',
    focus: ['每周跳舞 2 次', '口语表达更自然', 'Expression Review Hub 和 English Output Journey 联动', '日语轻量维持'],
    reminder: '快乐不是浪费时间。快乐是系统能坚持的燃料。',
  },
  '2027-05': {
    theme: '户外节奏',
    focus: ['每周一次 Holmesglen Reserve 长走', '稳定 study blocks', '继续 career / AI / cyber packaging', '减少低价值刷屏'],
    reminder: '走出去不是为了消耗卡路里，是为了把脑子重置。',
  },
  '2027-06': {
    theme: '身体成为优势',
    focus: ['回顾运动、英语、AI、career 这一年', '整理 Proof Vault', '做一次 365 总结', '计划下一轮系统'],
    reminder: '真正的变化不是某一天很努力，而是你越来越容易重新开始。',
  },
  '2027-07': {
    theme: '完成和复盘',
    focus: ['完成 Day 365', '写 365 Review', '看见自己已经积累的证据', '决定下一轮 365 是否开始'],
    reminder: '完成不是完美。完成是你没有放弃自己。',
  },
}

export function iris365DayInfo(date = getLocalDateKey()) {
  const start = new Date(`${IRIS365_MOMENTUM_START_DATE}T00:00:00`)
  const end = new Date(`${IRIS365_MOMENTUM_END_DATE}T00:00:00`)
  const current = new Date(`${date}T00:00:00`)
  const dayNumber = Math.max(1, Math.min(365, Math.floor((current.getTime() - start.getTime()) / 86_400_000) + 1))
  const daysRemaining = Math.max(0, Math.ceil((end.getTime() - current.getTime()) / 86_400_000))
  return { dayNumber, daysRemaining }
}

export function emptyIris365MomentumEntry(date = getLocalDateKey()): Iris365MomentumEntry {
  return {
    date,
    sleepRhythm: 'late but okay',
    movementDone: false,
    studyDone: false,
    englishOutputDone: false,
    aiOrCourseraDone: false,
    careerOrAdminDone: false,
    mood: 'okay',
    smallestWin: '',
    tomorrowRestartStep: '',
    updatedAt: new Date().toISOString(),
  }
}

export function loadIris365Momentum(): Iris365MomentumStore {
  if (typeof localStorage === 'undefined') return { entries: {} }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { entries: {} }
    const parsed = JSON.parse(raw) as Partial<Iris365MomentumStore>
    return { entries: parsed.entries && typeof parsed.entries === 'object' ? parsed.entries : {} }
  } catch (error) {
    console.warn('[Iris365Momentum] Failed to load log', error)
    return { entries: {} }
  }
}

export function saveIris365MomentumEntry(entry: Iris365MomentumEntry, store = loadIris365Momentum()) {
  const next = {
    entries: {
      ...store.entries,
      [entry.date]: { ...entry, updatedAt: new Date().toISOString() },
    },
  }
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

export function getMomentumStreak(entries: Record<string, Iris365MomentumEntry>, predicate: (entry: Iris365MomentumEntry) => boolean, date = getLocalDateKey()) {
  let streak = 0
  const current = new Date(`${date}T00:00:00`)
  for (let index = 0; index < 365; index += 1) {
    const key = getLocalDateKey(current)
    const entry = entries[key]
    if (!entry || !predicate(entry)) break
    streak += 1
    current.setDate(current.getDate() - 1)
  }
  return streak
}

export function iris365MomentumMarkdown(entry: Iris365MomentumEntry) {
  const { dayNumber } = iris365DayInfo(entry.date)
  const month = MONTHLY_MOMENTUM_PLAN[entry.date.slice(0, 7)] ?? MONTHLY_MOMENTUM_PLAN['2026-07']
  return `# Iris365 - Day ${dayNumber} / 365 - ${entry.date}

## Today’s check-in
- Sleep rhythm: ${entry.sleepRhythm}
- Movement: ${entry.movementDone ? 'yes' : 'no'}
- Study: ${entry.studyDone ? 'yes' : 'no'}
- English output: ${entry.englishOutputDone ? 'yes' : 'no'}
- AI / Coursera: ${entry.aiOrCourseraDone ? 'yes' : 'no'}
- Career / Admin: ${entry.careerOrAdminDone ? 'yes' : 'no'}

## Smallest win
- ${entry.smallestWin}

## Monthly momentum
- Month: ${entry.date.slice(0, 7)}
- Theme: ${month.theme}
- Goal: ${month.focus.join('; ')}

## Tomorrow restart step
- ${entry.tomorrowRestartStep}

Suggested destination: 10 Journal 日志/Daily/`
}
