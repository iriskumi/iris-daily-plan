import type { CalendarEvent, GoogleCalendarImportMeta, IntegrationResult } from '../types'

const notConnected = <T>(): IntegrationResult<T> => ({
  success: false,
  message: 'Integration not connected yet',
  data: null,
})

type CalendarApiResult = IntegrationResult<CalendarEvent[]> & {
  connected?: boolean
  calendarConnected?: boolean
  gmailConnected?: boolean
  accountEmail?: string
  warning?: string
}

export function connectGoogleCalendar(): void {
  window.location.href = '/api/google/auth'
}

export async function getGoogleCalendarStatus(): Promise<GoogleCalendarImportMeta> {
  try {
    const response = await fetch('/api/google/calendar-today?status=1')
    const result = (await response.json()) as CalendarApiResult
    return {
      connected: response.ok && Boolean(result.connected),
      calendarConnected: Boolean(result.calendarConnected),
      gmailConnected: Boolean(result.gmailConnected),
      accountEmail: result.accountEmail,
      warning: result.warning,
    }
  } catch {
    return {
      connected: false,
    }
  }
}

export async function fetchCalendarEvents(): Promise<IntegrationResult<CalendarEvent[]>> {
  try {
    const response = await fetch('/api/google/calendar-today')
    const result = (await response.json()) as CalendarApiResult
    if (!response.ok || !result.success || !result.data) {
      return {
        success: false,
        message: result.message || 'Google Calendar not connected',
        data: null,
      }
    }
    return {
      success: true,
      message: result.message,
      data: result.data,
    }
  } catch {
    return {
      success: false,
      message: 'Google Calendar not connected',
      data: null,
    }
  }
}

export async function importCalendarCommitments(): Promise<IntegrationResult<CalendarEvent[]>> {
  return fetchCalendarEvents()
}

export async function fetchManualCalendarEvents(): Promise<IntegrationResult<CalendarEvent[]>> {
  return notConnected<CalendarEvent[]>()
}
