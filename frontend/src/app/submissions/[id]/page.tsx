import { notFound } from 'next/navigation'
import { fetchSubmissionServer } from '@/lib/server-api'
import { SubmissionDetailClient } from './submission-detail-client'

export const revalidate = 60

export default async function SubmissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const submission = await fetchSubmissionServer(id)

  if (!submission) {
    notFound()
  }

  return <SubmissionDetailClient initialSubmission={submission} />
}
