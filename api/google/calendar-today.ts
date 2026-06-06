/// <reference types="node" />

import type { CalendarEvent, IntegrationResult } from '../../src/types.js'
import {
  TOKEN_COOKIE,
  TOKEN_STORAGE_WARNING,
  createCookie,
  decryptTokens,
  encryptTokens,
  getCookie,
  refreshAccessToken,
  requiredGoogleConfig,
  type GoogleTokens,
  type VercelRequest,
  type VercelResponse,
} from '../../server/google.js'

const MELBOURNE_TIMEZONE = 'Australia/Melbourne'

interface CalendarResponse extends IntegrationResult<CalendarEvent[]> {
  connected: boolean
  accountEmail?: string
  warning?: string
}

interface GoogleCalendarItem {
  id?: string
  summary?: string
  location?: string
  description?: string
  start?: {
    dateTime?: string
    date?: string
  }
  end?: {
    dateTime?: string
    date?: string
  }
}

function sendJson(res: VercelResponse, body: CalendarResponse, status = 200): void {
  res.status(status).json(body)
}

function notConnected(): CalendarResponse {
  return {
    success: false,
    message: 'Google Calendar not connected',
    data: null,
    connected: false,
  }
}

function getRequestUrl(req: VercelRequest): URL {
  const hostHeader = req.headers?.['x-forwarded-host'] ?? req.headers?.host ?? 'localhost'
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader
  const protoHeader = req.headers?.['x-forwarded-proto'] ?? 'https'
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader
  return new URL(req.url ?? '/api/google/calendar-today', `${proto}://${host}`)
}

function getMelbourneYmd(referenceDate = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MELBOURNE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(referenceDate)
  const year = parts.find(part => part.type === 'year')?.value ?? '1970'
  const month = parts.find(part => part.type === 'month')?.value ?? '01'
  const day = parts.find(part => part.type === 'day')?.value ?? '01'
  return `${year}-${month}-${day}`
}

function addDaysToYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

function getMelbourneOffset(ymd: string): string {
  const date = new Date(`${ymd}T12:00:00Z`)
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: MELBOURNE_TIMEZONE,
    timeZoneName: 'shortOffset',
  }).formatToParts(date)
  const offset = parts.find(part => part.type === 'timeZoneName')?.value ?? 'GMT+10'
  const match = offset.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
  if (!match) return '+10:00'
  const [, sign, hour, minute = '00'] = match
  return `${sign}${hour.padStart(2, '0')}:${minute}`
}

function calendarDateToIso(value: string): string {
  return `${value}T00:00:00${getMelbourneOffset(value)}`
}

function toCalendarEvent(item: GoogleCalendarItem): CalendarEvent | null {
  const startValue = item.start?.dateTime ?? (item.start?.date ? calendarDateToIso(item.start.date) : null)
  const endValue = item.end?.dateTime ?? (item.end?.date ? calendarDateToIso(item.end.date) : startValue)
  if (!item.id || !startValue || !endValue) return null

  return {
    id: item.id,
    title: item.summary || 'Untitled calendar event',
    start: startValue,
    end: endValue,
    location: item.location,
    description: item.description,
    source: 'google_calendar',
  }
}

async function getUsableTokens(
  req: VercelRequest,
  res: VercelResponse,
  config: { clientId: string; clientSecret: string },
): Promise<GoogleTokens | null> {
  const cookie = getCookie(req, TOKEN_COOKIE)
  if (!cookie) return null
  const tokens = decryptTokens(cookie, config.clientSecret)
  if (!tokens) return null

  if (tokens.expires_at - Date.now() > 60 * 1000) return tokens

  const refreshed = await refreshAccessToken(tokens, config)
  if (!refreshed) return null
  res.setHeader(
    'Set-Cookie',
    createCookie(TOKEN_COOKIE, encryptTokens(refreshed, config.clientSecret), {
      maxAgeSeconds: 60 * 60 * 24 * 30,
    }),
  )
  return refreshed
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    sendJson(res, {
      success: false,
      message: 'Method not allowed',
      data: null,
      connected: false,
    }, 405)
    return
  }

  const config = requiredGoogleConfig()
  if (!config) {
    sendJson(res, {
      success: false,
      message:
        'Google Calendar OAuth is not configured. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI.',
      data: null,
      connected: false,
    }, 500)
    return
  }

  const tokens = await getUsableTokens(req, res, config)
  if (!tokens) {
    sendJson(res, notConnected(), 401)
    return
  }

  const url = getRequestUrl(req)
  if (url.searchParams.get('status') === '1') {
    sendJson(res, {
      success: true,
      message: 'Google Calendar connected',
      data: [],
      connected: true,
      accountEmail: tokens.account_email,
      warning: TOKEN_STORAGE_WARNING,
    })
    return
  }

  const today = getMelbourneYmd()
  const rangeEnd = addDaysToYmd(today, 7)
  const params = new URLSearchParams({
    timeMin: `${today}T00:00:00${getMelbourneOffset(today)}`,
    timeMax: `${rangeEnd}T00:00:00${getMelbourneOffset(rangeEnd)}`,
    singleEvents: 'true',
    orderBy: 'startTime',
    timeZone: MELBOURNE_TIMEZONE,
    fields: 'items(id,summary,start,end,location,description)',
  })

  const calendarResponse = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    },
  )

  if (!calendarResponse.ok) {
    sendJson(res, {
      success: false,
      message: `Google Calendar returned ${calendarResponse.status}`,
      data: null,
      connected: true,
      accountEmail: tokens.account_email,
      warning: TOKEN_STORAGE_WARNING,
    }, calendarResponse.status)
    return
  }

  const payload = (await calendarResponse.json()) as { items?: GoogleCalendarItem[] }
  const events = (payload.items ?? [])
    .map(toCalendarEvent)
    .filter((event): event is CalendarEvent => event !== null)

  sendJson(res, {
    success: true,
    message: events.length > 0 ? `Imported ${events.length} calendar event(s) for the next 7 days` : 'No calendar events in the next 7 days',
    data: events,
    connected: true,
    accountEmail: tokens.account_email,
    warning: TOKEN_STORAGE_WARNING,
  })
}
