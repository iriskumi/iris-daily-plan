/// <reference types="node" />

import type { IntegrationResult, NotionBillsSyncError, NotionBillsSyncResult } from '../../src/types.js'

interface VercelRequest { method?: string }
interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
  setHeader: (name: string, value: string) => void
}

interface NotionPropertyValue {
  type?: string
  title?: Array<{ plain_text?: string }>
  number?: number | null
  date?: { start?: string | null } | null
  relation?: Array<{ id: string }>
}

interface NotionPage {
  id: string
  properties?: Record<string, NotionPropertyValue>
}

interface NotionListResponse {
  results?: NotionPage[]
  has_more?: boolean
  next_cursor?: string | null
  message?: string
}

interface NotionMutationResponse {
  id?: string
  url?: string
  message?: string
}

const BILL_SOURCE_FALLBACK = 'collection://353439b5-47d0-8083-a656-000bbf08797f'
const TRANSACTION_SOURCE_FALLBACK = 'collection://353439b5-47d0-80b3-b72a-000b40550152'

function sendJson(res: VercelResponse, body: IntegrationResult<NotionBillsSyncResult>, status = 200) {
  res.setHeader('Content-Type', 'application/json')
  res.status(status).json(body)
}

function notionId(value: string | undefined, fallback: string): string {
  return (value || fallback).replace(/^collection:\/\//, '').trim()
}

function richTitle(property: NotionPropertyValue | undefined): string {
  return property?.title?.map(part => part.plain_text || '').join('').trim() || 'Paid bill'
}

function relation(property: NotionPropertyValue | undefined): Array<{ id: string }> {
  return property?.relation?.map(item => ({ id: item.id })) || []
}

async function notionFetch<T>(
  path: string,
  init: RequestInit,
  headers: Record<string, string>,
): Promise<{ ok: boolean; status: number; body: T & { message?: string } }> {
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
  })
  const body = (await response.json()) as T & { message?: string }
  return { ok: response.ok, status: response.status, body }
}

async function queryPaidBills(
  billsDataSourceId: string,
  headers: Record<string, string>,
): Promise<{ bills: NotionPage[]; error?: { message: string; status: number } }> {
  const bills: NotionPage[] = []
  let start_cursor: string | undefined

  do {
    const { ok, status, body } = await notionFetch<NotionListResponse>(
      `/data_sources/${billsDataSourceId}/query`,
      {
        method: 'POST',
        body: JSON.stringify({
          start_cursor,
          page_size: 100,
          filter: {
            and: [
              { property: 'Status', select: { equals: 'Paid' } },
              { property: 'Paid Transaction', relation: { is_empty: true } },
            ],
          },
        }),
      },
      headers,
    )

    if (!ok || !body.results) {
      return { bills, error: { message: body.message || `Notion returned ${status} while querying bills.`, status } }
    }

    bills.push(...body.results)
    start_cursor = body.has_more ? body.next_cursor || undefined : undefined
  } while (start_cursor)

  return { bills }
}

async function queryPaidBillsLegacy(
  billsDatabaseId: string,
  headers: Record<string, string>,
): Promise<{ bills: NotionPage[]; error?: { message: string; status: number } }> {
  const legacyHeaders = { ...headers, 'Notion-Version': '2022-06-28' }
  const bills: NotionPage[] = []
  let start_cursor: string | undefined

  do {
    const { ok, status, body } = await notionFetch<NotionListResponse>(
      `/databases/${billsDatabaseId}/query`,
      {
        method: 'POST',
        body: JSON.stringify({
          start_cursor,
          page_size: 100,
          filter: {
            and: [
              { property: 'Status', select: { equals: 'Paid' } },
              { property: 'Paid Transaction', relation: { is_empty: true } },
            ],
          },
        }),
      },
      legacyHeaders,
    )

    if (!ok || !body.results) {
      return { bills, error: { message: body.message || `Notion returned ${status} while querying bills.`, status } }
    }

    bills.push(...body.results)
    start_cursor = body.has_more ? body.next_cursor || undefined : undefined
  } while (start_cursor)

  return { bills }
}

async function createTransaction(
  transactionDataSourceId: string,
  bill: NotionPage,
  headers: Record<string, string>,
  parentKey: 'data_source_id' | 'database_id' = 'data_source_id',
): Promise<{ id?: string; error?: string }> {
  const properties = bill.properties || {}
  const billName = richTitle(properties['Bill Name'])
  const amount = properties.Amount?.number
  const dueDate = properties['Due Date']?.date?.start
  const category = relation(properties.Category)

  if (typeof amount !== 'number') return { error: 'Bill is missing an Amount number.' }
  if (!dueDate) return { error: 'Bill is missing a Due Date.' }

  const requestHeaders = parentKey === 'database_id' ? { ...headers, 'Notion-Version': '2022-06-28' } : headers
  const { ok, status, body } = await notionFetch<NotionMutationResponse>(
    '/pages',
    {
      method: 'POST',
      body: JSON.stringify({
        parent: { [parentKey]: transactionDataSourceId },
        properties: {
          Description: { title: [{ text: { content: billName } }] },
          Amount: { number: amount },
          Date: { date: { start: dueDate } },
          Type: { select: { name: 'Expense' } },
          Currency: { select: { name: 'AUD' } },
          Category: { relation: category },
          Bills: { relation: [{ id: bill.id }] },
        },
      }),
    },
    requestHeaders,
  )

  if (!ok || !body.id) return { error: body.message || `Notion returned ${status} while creating the transaction.` }
  return { id: body.id }
}

async function attachPaidTransaction(
  billId: string,
  transactionId: string,
  headers: Record<string, string>,
): Promise<string | null> {
  const { ok, status, body } = await notionFetch<NotionMutationResponse>(
    `/pages/${billId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        properties: {
          'Paid Transaction': { relation: [{ id: transactionId }] },
        },
      }),
    },
    headers,
  )

  if (!ok) return body.message || `Notion returned ${status} while updating the bill.`
  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    sendJson(res, { success: false, message: 'Method not allowed', data: null }, 405)
    return
  }

  const notionKey = process.env.NOTION_API_KEY
  const billsDataSourceId = notionId(
    process.env.NOTION_BILLS_DATA_SOURCE_ID || process.env.NOTION_BILLS_DATABASE_ID,
    BILL_SOURCE_FALLBACK,
  )
  const transactionDataSourceId = notionId(
    process.env.NOTION_TRANSACTIONS_DATA_SOURCE_ID || process.env.NOTION_TRANSACTIONS_DATABASE_ID,
    TRANSACTION_SOURCE_FALLBACK,
  )

  if (!notionKey) {
    sendJson(res, {
      success: false,
      message: 'Notion is not connected yet. Add NOTION_API_KEY.',
      data: null,
    })
    return
  }

  const headers = {
    Authorization: `Bearer ${notionKey}`,
    'Content-Type': 'application/json',
    'Notion-Version': '2025-09-03',
  }

  console.log('[Notion Bills Sync] Querying paid bills without a Paid Transaction relation.')
  let query = await queryPaidBills(billsDataSourceId, headers)
  let transactionParentKey: 'data_source_id' | 'database_id' = 'data_source_id'
  if (query.error && [400, 404].includes(query.error.status)) {
    console.warn(`[Notion Bills Sync] Data source query failed, retrying legacy database query: ${query.error.message}`)
    query = await queryPaidBillsLegacy(billsDataSourceId, headers)
    transactionParentKey = 'database_id'
  }
  if (query.error) {
    sendJson(res, {
      success: false,
      message: query.error.message,
      data: {
        scanned: 0,
        created: 0,
        skipped: 0,
        errors: [{ message: query.error.message }],
        syncedAt: new Date().toISOString(),
      },
    }, query.error.status)
    return
  }

  let created = 0
  let skipped = 0
  const errors: NotionBillsSyncError[] = []

  for (const bill of query.bills) {
    const billName = richTitle(bill.properties?.['Bill Name'])
    const paidTransaction = relation(bill.properties?.['Paid Transaction'])
    if (paidTransaction.length > 0) {
      skipped += 1
      console.log(`[Notion Bills Sync] Skipped "${billName}" because it already has a Paid Transaction.`)
      continue
    }

    console.log(`[Notion Bills Sync] Creating expense transaction for "${billName}".`)
    const transaction = await createTransaction(transactionDataSourceId, bill, headers, transactionParentKey)
    if (!transaction.id) {
      skipped += 1
      const message = transaction.error || 'Transaction was not created.'
      errors.push({ billId: bill.id, billName, message })
      console.error(`[Notion Bills Sync] ${billName}: ${message}`)
      continue
    }

    const attachError = await attachPaidTransaction(bill.id, transaction.id, headers)
    if (attachError) {
      errors.push({ billId: bill.id, billName, message: attachError })
      console.error(`[Notion Bills Sync] Created transaction for "${billName}" but could not update the bill: ${attachError}`)
      continue
    }

    created += 1
    console.log(`[Notion Bills Sync] Synced "${billName}" to transaction ${transaction.id}.`)
  }

  const result: NotionBillsSyncResult = {
    scanned: query.bills.length,
    created,
    skipped,
    errors,
    syncedAt: new Date().toISOString(),
  }

  sendJson(res, {
    success: errors.length === 0,
    message: `Sync complete: scanned ${result.scanned}, created ${result.created}, skipped ${result.skipped}, errors ${result.errors.length}.`,
    data: result,
  })
}
