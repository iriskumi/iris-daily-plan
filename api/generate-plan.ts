import type {
  GeneratedPlan,
  GeneratePlanContext,
  GeneratePlanResult,
  TimeBlock,
} from '../src/types'

interface VercelRequest {
  method?: string
  body?: unknown
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
  setHeader: (name: string, value: string) => void
  end: () => void
}

const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'date',
    'theme',
    'top3',
    'timeBlocks',
    'mustDo',
    'optional',
    'workLeadsToday',
    'billsToday',
    'doNotToday',
    'minimumViableDay',
  ],
  properties: {
    date: { type: 'string' },
    theme: { type: 'string' },
    top3: {
      type: 'array',
      minItems: 0,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['task', 'nextAction'],
        properties: {
          task: { type: 'string' },
          nextAction: { type: 'string' },
        },
      },
    },
    timeBlocks: {
      type: 'array',
      minItems: 1,
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['period', 'label', 'items'],
        properties: {
          period: {
            type: 'string',
            enum: ['morning', 'afternoon', 'evening', 'recovery', 'shutdown'],
          },
          label: { type: 'string' },
          items: {
            type: 'array',
            minItems: 1,
            maxItems: 8,
            items: { type: 'string' },
          },
        },
      },
    },
    mustDo: {
      type: 'array',
      items: { type: 'string' },
    },
    optional: {
      type: 'array',
      items: { type: 'string' },
    },
    workLeadsToday: {
      type: 'array',
      items: { type: 'string' },
    },
    billsToday: {
      type: 'array',
      items: { type: 'string' },
    },
    doNotToday: {
      type: 'array',
      items: { type: 'string' },
    },
    minimumViableDay: {
      type: 'array',
      minItems: 1,
      items: { type: 'string' },
    },
  },
}

type AiProvider = 'openai' | 'deepseek' | 'gemini'

interface ProviderConfig {
  provider: AiProvider
  apiKey: string
  model: string
  endpoint: string
}

function sendJson(res: VercelResponse, body: GeneratePlanResult, status = 200): void {
  res.status(status).json(body)
}

function getProviderConfig(): ProviderConfig | null {
  const provider = process.env.AI_PROVIDER

  if (provider === 'deepseek') {
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) return null
    return {
      provider,
      apiKey,
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      endpoint: 'https://api.deepseek.com/chat/completions',
    }
  }

  if (provider === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return null
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
    return {
      provider,
      apiKey,
      model,
      endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    }
  }

  if (provider === 'openai' || !provider) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return null
    return {
      provider: 'openai',
      apiKey,
      model: process.env.OPENAI_MODEL || 'gpt-5-4-mini',
      endpoint: 'https://api.openai.com/v1/chat/completions',
    }
  }

  return null
}

function isContext(value: unknown): value is GeneratePlanContext {
  if (typeof value !== 'object' || value === null) return false
  const context = value as Partial<GeneratePlanContext>
  return (
    typeof context.checkin === 'object' &&
    context.checkin !== null &&
    Array.isArray(context.tasks) &&
    Array.isArray(context.opportunities) &&
    Array.isArray(context.bills) &&
    Array.isArray(context.templates) &&
    typeof context.settings === 'object' &&
    context.settings !== null
  )
}

function getBody(req: VercelRequest): unknown {
  if (typeof req.body === 'string') return JSON.parse(req.body) as unknown
  return req.body
}

function markdownExport(plan: Omit<GeneratedPlan, 'notionMarkdown'>): string {
  let md = `# Daily Plan - ${plan.date}\n\n`
  md += `## Today's Theme\n${plan.theme}\n\n`

  md += `## Top 3\n`
  plan.top3.forEach(item => {
    md += `- [ ] ${item.task}\n`
    md += `  -> ${item.nextAction}\n`
  })
  md += '\n'

  md += `## Time Blocks\n`
  plan.timeBlocks.forEach(block => {
    md += `### ${block.label}\n`
    block.items.forEach(item => {
      md += `- ${item}\n`
    })
    md += '\n'
  })

  md += `## Work / Consulting Leads\n`
  if (plan.workLeadsToday.length > 0) {
    plan.workLeadsToday.forEach(item => {
      md += `- ${item}\n`
    })
  } else {
    md += '- No urgent leads today\n'
  }
  md += '\n'

  md += `## Bills\n`
  if (plan.billsToday.length > 0) {
    plan.billsToday.forEach(item => {
      md += `- ${item}\n`
    })
  } else {
    md += '- Nothing urgent today\n'
  }
  md += '\n'

  md += `## Do Not Do Today\n`
  plan.doNotToday.forEach(item => {
    md += `- ${item}\n`
  })
  md += '\n'

  md += `## Minimum Viable Day\n`
  plan.minimumViableDay.forEach(item => {
    md += `- [ ] ${item}\n`
  })

  return md
}

function normalizePlan(raw: unknown, context: GeneratePlanContext): GeneratedPlan | null {
  if (typeof raw !== 'object' || raw === null) return null
  const plan = raw as Partial<GeneratedPlan>
  if (
    typeof plan.theme !== 'string' ||
    !Array.isArray(plan.top3) ||
    !Array.isArray(plan.timeBlocks) ||
    !Array.isArray(plan.mustDo) ||
    !Array.isArray(plan.optional) ||
    !Array.isArray(plan.workLeadsToday) ||
    !Array.isArray(plan.billsToday) ||
    !Array.isArray(plan.doNotToday) ||
    !Array.isArray(plan.minimumViableDay)
  ) {
    return null
  }

  const normalized: Omit<GeneratedPlan, 'notionMarkdown'> = {
    date: context.checkin.date,
    theme: plan.theme,
    top3: plan.top3.slice(0, 3).map(item => {
      const topItem = item as { task?: unknown; nextAction?: unknown }
      return {
        task: typeof topItem.task === 'string' ? topItem.task : 'Review priority',
        nextAction:
          typeof topItem.nextAction === 'string'
            ? topItem.nextAction
            : 'Define the next action before starting',
      }
    }),
    timeBlocks: (plan.timeBlocks as TimeBlock[]).filter(block =>
      ['morning', 'afternoon', 'evening', 'recovery', 'shutdown'].includes(block.period),
    ),
    mustDo: plan.mustDo.filter(item => typeof item === 'string') as string[],
    optional: plan.optional.filter(item => typeof item === 'string') as string[],
    workLeadsToday: plan.workLeadsToday.filter(item => typeof item === 'string') as string[],
    billsToday: plan.billsToday.filter(item => typeof item === 'string') as string[],
    doNotToday: plan.doNotToday.filter(item => typeof item === 'string') as string[],
    minimumViableDay: plan.minimumViableDay.filter(item => typeof item === 'string') as string[],
    generatedAt: new Date().toISOString(),
  }

  if (normalized.timeBlocks.length === 0 || normalized.minimumViableDay.length === 0) return null

  return {
    ...normalized,
    notionMarkdown: markdownExport(normalized),
  }
}

function extractOutputText(response: unknown): string | null {
  if (typeof response !== 'object' || response === null) return null
  const maybe = response as {
    output_text?: unknown
    output?: unknown
    choices?: unknown
    candidates?: unknown
  }
  if (Array.isArray(maybe.choices)) {
    const first = maybe.choices[0] as { message?: { content?: unknown } } | undefined
    const content = first?.message?.content
    if (typeof content === 'string') return content
  }
  if (Array.isArray(maybe.candidates)) {
    const first = maybe.candidates[0] as {
      content?: { parts?: Array<{ text?: unknown }> }
    } | undefined
    const parts = first?.content?.parts
    if (Array.isArray(parts)) {
      const text = parts.map(part => part.text).filter(textPart => typeof textPart === 'string').join('')
      if (text) return text
    }
  }
  if (typeof maybe.output_text === 'string') return maybe.output_text
  if (!Array.isArray(maybe.output)) return null

  for (const output of maybe.output) {
    const item = output as { content?: unknown }
    if (!Array.isArray(item.content)) continue
    for (const content of item.content) {
      const part = content as { text?: unknown }
      if (typeof part.text === 'string') return part.text
    }
  }
  return null
}

function buildResponseFormat(provider: AiProvider) {
  if (provider === 'openai') {
    return {
      type: 'json_schema',
      json_schema: {
        name: 'iris_daily_plan',
        schema: PLAN_SCHEMA,
        strict: true,
      },
    }
  }

  return { type: 'json_object' }
}

function toGeminiSchema(schema: unknown): unknown {
  if (typeof schema !== 'object' || schema === null) return schema
  if (Array.isArray(schema)) return schema.map(toGeminiSchema)
  const current = schema as Record<string, unknown>
  const next: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(current)) {
    if (key === 'additionalProperties') continue
    if (key === 'type' && typeof value === 'string') {
      next[key] = value.toUpperCase()
    } else {
      next[key] = toGeminiSchema(value)
    }
  }

  return next
}

function buildMessages(requestContext: GeneratePlanContext) {
  return [
    {
      role: 'system',
      content:
        'You are a practical daily planning assistant. Return JSON only. The JSON must match the Iris GeneratedPlan fields requested by the user. Respect energy level, deadlines, bills, work leads, settings, and recovery needs. Do not invent API integrations or external data.',
    },
    {
      role: 'user',
      content: JSON.stringify({
        instruction:
          'Create one realistic daily plan in the existing Iris Daily Plan format. Return a single JSON object with these exact fields: date, theme, top3, timeBlocks, mustDo, optional, workLeadsToday, billsToday, doNotToday, minimumViableDay. Use only this structured context.',
        schema: PLAN_SCHEMA,
        context: requestContext,
      }),
    },
  ]
}

async function callAiProvider(config: ProviderConfig, requestContext: GeneratePlanContext): Promise<Response> {
  const messages = buildMessages(requestContext)

  if (config.provider === 'gemini') {
    return fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'x-goog-api-key': config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `${messages[0].content}\n\n${messages[1].content}`,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: toGeminiSchema(PLAN_SCHEMA),
          temperature: 0.4,
        },
      }),
    })
  }

  return fetch(config.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      response_format: buildResponseFormat(config.provider),
      temperature: 0.4,
    }),
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    sendJson(res, {
      success: false,
      message: 'Method not allowed; using local planner fallback',
      data: null,
    }, 405)
    return
  }

  const providerConfig = getProviderConfig()
  if (!providerConfig) {
    sendJson(res, {
      success: false,
      message:
        'No valid AI provider key found. Set AI_PROVIDER=openai with OPENAI_API_KEY, AI_PROVIDER=deepseek with DEEPSEEK_API_KEY, or AI_PROVIDER=gemini with GEMINI_API_KEY; using local planner fallback',
      data: null,
    })
    return
  }

  let requestContext: GeneratePlanContext
  try {
    const body = getBody(req)
    if (!isContext(body)) {
      sendJson(res, {
        success: false,
        message: 'Invalid planning context; using local planner fallback',
        data: null,
      }, 400)
      return
    }
    requestContext = body
  } catch {
    sendJson(res, {
      success: false,
      message: 'Could not read planning context; using local planner fallback',
      data: null,
    }, 400)
    return
  }

  const aiResponse = await callAiProvider(providerConfig, requestContext)

  if (!aiResponse.ok) {
    sendJson(res, {
      success: false,
      message: `${providerConfig.provider} API returned ${aiResponse.status}; using local planner fallback`,
      data: null,
    })
    return
  }

  try {
    const payload = (await aiResponse.json()) as unknown
    const outputText = extractOutputText(payload)
    if (!outputText) {
      sendJson(res, {
        success: false,
        message: `${providerConfig.provider} response had no plan output; using local planner fallback`,
        data: null,
      })
      return
    }

    const rawPlan = JSON.parse(outputText) as unknown
    const plan = normalizePlan(rawPlan, requestContext)
    if (!plan) {
      sendJson(res, {
        success: false,
        message: `${providerConfig.provider} response did not match GeneratedPlan shape; using local planner fallback`,
        data: null,
      })
      return
    }

    sendJson(res, {
      success: true,
      message: `Generated plan with ${providerConfig.provider}`,
      data: plan,
    })
  } catch {
    sendJson(res, {
      success: false,
      message: `Could not parse ${providerConfig.provider} plan; using local planner fallback`,
      data: null,
    })
  }
}
