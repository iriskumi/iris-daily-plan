import type { CalendarEvent, IntegrationResult } from '../types'

const notConnected = <T>(): IntegrationResult<T> => ({
  success: false,
  message: 'Integration not connected yet',
  data: null,
})

export async function fetchCalendarEvents(): Promise<IntegrationResult<CalendarEvent[]>> {
  return notConnected<CalendarEvent[]>()
}

export async function importCalendarCommitments(): Promise<IntegrationResult<CalendarEvent[]>> {
  return notConnected<CalendarEvent[]>()
}
