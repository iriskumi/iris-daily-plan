import type {
  EmailMessage,
  ExtractedBill,
  ExtractedWorkLead,
  GmailScannedWorkLead,
  IntegrationResult,
} from '../types'

const notConnected = <T>(): IntegrationResult<T> => ({
  success: false,
  message: 'Integration not connected yet',
  data: null,
})

export async function fetchRecentEmails(): Promise<IntegrationResult<EmailMessage[]>> {
  return notConnected<EmailMessage[]>()
}

export async function extractBillsFromEmailText(
  _text: string,
): Promise<IntegrationResult<ExtractedBill[]>> {
  return notConnected<ExtractedBill[]>()
}

export async function extractWorkLeadsFromEmailText(
  _text: string,
): Promise<IntegrationResult<ExtractedWorkLead[]>> {
  return notConnected<ExtractedWorkLead[]>()
}

export async function scanGmailForWorkLeads(): Promise<IntegrationResult<GmailScannedWorkLead[]>> {
  try {
    const response = await fetch('/api/google/gmail-job-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    const result = (await response.json()) as IntegrationResult<GmailScannedWorkLead[]>
    if (!response.ok || !result.success || !result.data) {
      return {
        success: false,
        message: result.message || 'Gmail scan failed. Check Google connection and try again.',
        data: null,
      }
    }
    return result
  } catch {
    return {
      success: false,
      message: 'Gmail scan failed. Check Google connection and try again.',
      data: null,
    }
  }
}
