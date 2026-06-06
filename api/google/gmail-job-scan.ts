/// <reference types="node" />

import crypto from 'node:crypto'
import type { GmailScannedWorkLead, IntegrationResult, WorkOpportunityType } from '../../src/types.js'

interface VercelRequest {
  method?: string
  headers?: Record<string, string | string[] | undefined>
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
  setHeader: (name: string, value: string | string[]) => void
}

interface GoogleTokens {
  access_token: string
  refresh_token?: string
  expires_at: number
  scope?: string
  account_email?: string
}

interface GmailHeader {
  name?: string
  value?: string
}

interface GmailMessage {
  id?: string
  snippet?: string
  payload?: {
    headers?: GmailHeader[]
  }
}

interface CandidateEmail {
  id: string
  sender: string
  subject: string
  date: string
  snippet: string
  links: string[]
}

type ScanResult = IntegrationResult<GmailScannedWorkLead[]> & {
  connected: boolean
  accountEmail?: string
}

const TOKEN_COOKIE = 'iris_google_calendar_tokens'
const GMAIL_SEARCH_QUERY =
  'newer_than:7d (subject:(job OR role OR application OR alert OR opportunity) OR from:(seek OR indeed OR linkedin OR jora OR glassdoor OR smartrecruiters OR greenhouse OR lever))'

function sendJson(res: VercelResponse, body: ScanResult, status = 200): void {
  res.setHeader('Content-Type', 'application/json')
  res.status(status).json(body)
}

function getCookie(req: VercelRequest, name: string): string | null {
  const rawHeader = req.headers?.cookie
  const raw = Array.isArray(rawHeader) ? rawHeader.join('; ') : rawHeader
  if (!raw) return null
  const cookies = raw.split(';').map(part => part.trim())
  const prefix = `${name}=`
  const match = cookies.find(cookie => cookie.startsWith(prefix))
  return match ? decodeURIComponent(match.slice(prefix.length)) : null
}

function getGoogleConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret }
}

function getEncryptionKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest()
}

function decryptTokens(value: string, secret: string): GoogleTokens | null {
  try {
    const payload = Buffer.from(value, 'base64url')
    const iv = payload.subarray(0, 12)
    const authTag = payload.subarray(12, 28)
    const encrypted = payload.subarray(28)
    const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(secret), iv)
    decipher.setAuthTag(authTag)
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
    return JSON.parse(decrypted) as GoogleTokens
  } catch {
    return null
  }
}

function createCookie(name: string, value: string, maxAgeSeconds: number): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'SameSite=Lax',
    'HttpOnly',
    `Max-Age=${maxAgeSeconds}`,
  ]
  if (process.env.NODE_ENV === 'production') parts.push('Secure')
  return parts.join('; ')
}

function encryptTokens(tokens: GoogleTokens, secret: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(secret), iv)
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(tokens), 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted]).toString('base64url')
}

async function refreshAccessToken(
  tokens: GoogleTokens,
  config: { clientId: string; clientSecret: string },
): Promise<GoogleTokens | null> {
  if (!tokens.refresh_token) return null
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  if (!response.ok) return null
  const payload = (await response.json()) as { access_token?: string; expires_in?: number }
  if (!payload.access_token || !payload.expires_in) return null
  return {
    ...tokens,
    access_token: payload.access_token,
    expires_at: Date.now() + payload.expires_in * 1000,
  }
}

async function getTokens(req: VercelRequest, res: VercelResponse): Promise<GoogleTokens | null> {
  const config = getGoogleConfig()
  if (!config) return null
  const cookie = getCookie(req, TOKEN_COOKIE)
  if (!cookie) return null
  const tokens = decryptTokens(cookie, config.clientSecret)
  if (!tokens) return null
  if (tokens.expires_at - Date.now() > 60 * 1000) return tokens
  const refreshed = await refreshAccessToken(tokens, config)
  if (!refreshed) return null
  res.setHeader(
    'Set-Cookie',
    createCookie(TOKEN_COOKIE, encryptTokens(refreshed, config.clientSecret), 60 * 60 * 24 * 30),
  )
  return refreshed
}

function headerValue(message: GmailMessage, name: string): string {
  const header = message.payload?.headers?.find(item => item.name?.toLowerCase() === name.toLowerCase())
  return header?.value ?? ''
}

function extractLinks(text: string): string[] {
  return Array.from(text.matchAll(/https?:\/\/[^\s<>"')]+/g))
    .map(match => match[0])
    .slice(0, 3)
}

async function fetchCandidateEmails(accessToken: string): Promise<CandidateEmail[] | null> {
  const listParams = new URLSearchParams({
    q: GMAIL_SEARCH_QUERY,
    maxResults: '20',
  })
  const listResponse = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${listParams.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!listResponse.ok) return null
  const listPayload = (await listResponse.json()) as { messages?: Array<{ id?: string }> }
  const ids = (listPayload.messages ?? []).map(message => message.id).filter((id): id is string => Boolean(id))

  const messages = await Promise.all(ids.map(async id => {
    const params = new URLSearchParams({
      format: 'metadata',
      metadataHeaders: 'From',
    })
    params.append('metadataHeaders', 'Subject')
    params.append('metadataHeaders', 'Date')
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    if (!response.ok) return null
    return (await response.json()) as GmailMessage
  }))

  return messages
    .filter((message): message is GmailMessage => message !== null && Boolean(message.id))
    .map(message => ({
      id: message.id as string,
      sender: headerValue(message, 'From'),
      subject: headerValue(message, 'Subject') || '(no subject)',
      date: headerValue(message, 'Date'),
      snippet: message.snippet ?? '',
      links: extractLinks(`${message.snippet ?? ''} ${headerValue(message, 'Subject')}`),
    }))
}

function tokenHasGmailScope(tokens: GoogleTokens): boolean {
  return Boolean(tokens.scope?.split(/\s+/).includes('https://www.googleapis.com/auth/gmail.readonly'))
}

function normalizeType(type: unknown): WorkOpportunityType {
  const allowed: WorkOpportunityType[] = [
    'full-time',
    'casual',
    'freelance',
    'consulting',
    'ai-data',
    'translation-language',
    'university-tafe-admin',
    'government-council',
  ]
  return typeof type === 'string' && allowed.includes(type as WorkOpportunityType)
    ? type as WorkOpportunityType
    : 'full-time'
}

function localClassify(candidates: CandidateEmail[]): GmailScannedWorkLead[] {
  return candidates.map(email => {
    const text = `${email.sender} ${email.subject} ${email.snippet}`.toLowerCase()
    const classification =
      text.includes('application received') || text.includes('viewed your application')
        ? 'ignore'
        : text.includes('seek') || text.includes('linkedin') || text.includes('greenhouse') || text.includes('lever')
          ? 'worth-checking-today'
          : 'later'
    return {
      messageId: email.id,
      title: email.subject,
      source: email.sender || 'Gmail',
      link: email.links[0],
      type: 'full-time',
      classification,
      reason: 'Rule-based scan from sender, subject, and snippet only.',
      nextAction: classification === 'ignore' ? 'No action' : 'Open the job link and check fit/salary/location.',
      confidence: classification === 'ignore' ? 0.5 : 0.65,
      sender: email.sender,
      subject: email.subject,
      receivedAt: email.date,
    }
  })
}

async function classifyWithGemini(candidates: CandidateEmail[]): Promise<GmailScannedWorkLead[] | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || candidates.length === 0) return null
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{
            text: JSON.stringify({
              instruction:
                'Classify recent job-related Gmail candidates using only sender, subject, date, snippet, and links. Return JSON only: {"leads":[...]} with fields messageId,title,source,link,type,classification,reason,nextAction,confidence. classification must be worth-checking-today, later, or ignore. type must be one of full-time, casual, freelance, consulting, ai-data, translation-language, university-tafe-admin, government-council. Do not invent details not present in the snippet.',
              candidates,
            }),
          }],
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      }),
    },
  )
  if (!response.ok) return null
  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>
  }
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text
  if (typeof text !== 'string') return null
  const parsed = JSON.parse(text) as { leads?: Array<Partial<GmailScannedWorkLead>> }
  if (!Array.isArray(parsed.leads)) return null
  return parsed.leads.map((lead, index) => {
    const candidate = candidates.find(item => item.id === lead.messageId) ?? candidates[index]
    const classification = lead.classification === 'worth-checking-today' || lead.classification === 'later' || lead.classification === 'ignore'
      ? lead.classification
      : 'later'
    return {
      messageId: candidate.id,
      title: typeof lead.title === 'string' && lead.title ? lead.title : candidate.subject,
      source: typeof lead.source === 'string' && lead.source ? lead.source : candidate.sender || 'Gmail',
      link: typeof lead.link === 'string' ? lead.link : candidate.links[0],
      type: normalizeType(lead.type),
      classification,
      reason: typeof lead.reason === 'string' ? lead.reason : 'Classified from Gmail subject and snippet.',
      nextAction: typeof lead.nextAction === 'string' ? lead.nextAction : 'Review the email and decide whether to apply.',
      confidence: typeof lead.confidence === 'number' ? Math.max(0, Math.min(1, lead.confidence)) : 0.6,
      sender: candidate.sender,
      subject: candidate.subject,
      receivedAt: candidate.date,
    }
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, {
      success: false,
      message: 'Method not allowed',
      data: null,
      connected: false,
    }, 405)
    return
  }

  const tokens = await getTokens(req, res)
  if (!tokens || !tokenHasGmailScope(tokens)) {
    sendJson(res, {
      success: false,
      message: 'Gmail read-only access is not connected yet.',
      data: null,
      connected: false,
    })
    return
  }

  const candidates = await fetchCandidateEmails(tokens.access_token)
  if (!candidates) {
    sendJson(res, {
      success: false,
      message: 'Gmail read-only access is not connected yet. Reconnect Google to grant Gmail read-only scope.',
      data: null,
      connected: true,
      accountEmail: tokens.account_email,
    })
    return
  }

  const leads = await classifyWithGemini(candidates).catch(() => null)
  sendJson(res, {
    success: true,
    message: candidates.length === 0
      ? 'No recent job-related Gmail candidates found.'
      : `Scanned ${candidates.length} recent job-related email(s).`,
    data: leads ?? localClassify(candidates),
    connected: true,
    accountEmail: tokens.account_email,
  })
}
