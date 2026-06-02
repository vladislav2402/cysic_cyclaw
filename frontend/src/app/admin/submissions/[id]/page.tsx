import { AdminSubmissionDetailClient } from './admin-submission-detail-client'

export default async function AdminSubmissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <AdminSubmissionDetailClient id={id} />
}
