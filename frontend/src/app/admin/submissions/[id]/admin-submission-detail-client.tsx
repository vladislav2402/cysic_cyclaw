'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ErrorState } from '@/components/ErrorState'
import { LoadingState } from '@/components/LoadingState'
import { PageShell } from '@/components/PageShell'
import { StatusPill } from '@/components/StatusPill'
import { TweetEmbed } from '@/components/TweetEmbed'
import { api } from '@/lib/api'
import type { Submission } from '@/lib/types'

export function AdminSubmissionDetailClient({ id }: { id: string }) {
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    api
      .adminSubmission(id)
      .then((data) => {
        if (!ignore) setSubmission(data)
      })
      .catch((err: Error) => {
        if (!ignore) setError(err.message)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [id])

  async function moderate(action: 'approve' | 'reject') {
    setError(null)
    try {
      const updated = action === 'approve' ? await api.approveSubmission(id) : await api.rejectSubmission(id, reason)
      setSubmission(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Moderation failed.')
    }
  }

  if (loading) {
    return (
      <PageShell title="Loading admin detail">
        <LoadingState />
      </PageShell>
    )
  }

  return (
    <PageShell eyebrow="Admin Detail" title={submission?.project_title || 'Submission review'}>
      {error ? <ErrorState message={error} /> : null}
      {submission ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="max-h-[34rem] min-w-0 overflow-y-auto rounded-lg">
            <TweetEmbed id={submission.tweet_id} url={submission.tweet_url} />
          </div>
          <aside className="cy-card h-fit p-5">
            <StatusPill status={submission.status} />
            <dl className="mt-5 grid gap-4 text-sm">
              <div>
                <dt className="text-slate-500">Participant</dt>
                <dd className="text-white">{submission.participant_name}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Tweet URL</dt>
                <dd className="break-all text-cyan">{submission.tweet_url}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Description</dt>
                <dd className="text-slate-200">{submission.description || 'No description supplied.'}</dd>
              </div>
            </dl>
            {submission.status !== 'rejected' ? (
              <label className="mt-5 grid gap-2">
                <span className="cy-label">Rejection reason</span>
                <textarea className="cy-input min-h-28" value={reason} onChange={(event) => setReason(event.target.value)} />
              </label>
            ) : null}
            <div className="mt-5 grid gap-3">
              {submission.status === 'pending' ? <button className="cy-button" onClick={() => moderate('approve')}>Approve</button> : null}
              {submission.status !== 'rejected' ? <button className="cy-button-secondary border-rose-300/30" onClick={() => moderate('reject')}>Reject</button> : null}
              <Link href="/admin/submissions" className="cy-button-secondary">Back to moderation</Link>
            </div>
          </aside>
        </div>
      ) : null}
    </PageShell>
  )
}
