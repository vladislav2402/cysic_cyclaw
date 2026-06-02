import { notFound } from 'next/navigation'
import { SubmissionDetailClient } from '@/app/submissions/[id]/submission-detail-client'
import { fetchSubmissionServer } from '@/lib/server-api'

const HANDLE_RE = /^[A-Za-z0-9_]{1,20}$/
const RESERVED_HANDLES = new Set(['admin', 'api', 'leaderboard', 'login', 'submit', 'submissions'])
export const revalidate = 60

export default async function PublicSubmissionPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const normalizedHandle = handle.trim().replace(/^@/, '')

  if (!HANDLE_RE.test(normalizedHandle) || RESERVED_HANDLES.has(normalizedHandle.toLowerCase())) {
    notFound()
  }

  const submission = await fetchSubmissionServer(normalizedHandle)

  if (!submission) {
    notFound()
  }

  return <SubmissionDetailClient initialSubmission={submission} />
}
