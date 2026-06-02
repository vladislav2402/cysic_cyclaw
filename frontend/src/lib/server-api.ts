import type { Submission } from '@/lib/types'

const SUBMISSION_REVALIDATE_SECONDS = 60

function apiBaseUrl() {
  const value = process.env.API_PROXY_URL || process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || ''
  if (!value) {
    throw new Error('Frontend server API is not configured. Set API_PROXY_URL or API_BASE_URL.')
  }
  return value.replace(/\/+$/, '')
}

function submissionLookupPath(value: string) {
  const cleaned = value.trim().replace(/^@/, '')
  if (/^\d+$/.test(cleaned)) {
    return `/submissions/${cleaned}`
  }
  return `/submissions/by-handle/${encodeURIComponent(cleaned)}`
}

export async function fetchSubmissionServer(idOrHandle: string): Promise<Submission | null> {
  const response = await fetch(`${apiBaseUrl()}/api${submissionLookupPath(idOrHandle)}`, {
    next: {
      revalidate: SUBMISSION_REVALIDATE_SECONDS,
    },
  })
  if (response.status === 404 || response.status === 422) {
    return null
  }
  if (!response.ok) {
    throw new Error(`Failed to load submission ${idOrHandle}.`)
  }
  return (await response.json()) as Submission
}
