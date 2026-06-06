import type {
  EmailMessage,
  ExtractedBill,
  ExtractedWorkLead,
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
