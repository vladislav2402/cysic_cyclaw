'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ErrorState } from '@/components/ErrorState'
import { LoadingState } from '@/components/LoadingState'
import { PageShell } from '@/components/PageShell'
import { StatusPill } from '@/components/StatusPill'
import { api } from '@/lib/api'
import type { Submission, SubmissionStatus, User } from '@/lib/types'

const statuses: SubmissionStatus[] = ['pending', 'approved', 'rejected']

export default function AdminSubmissionsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [activeStatus, setActiveStatus] = useState<SubmissionStatus>('pending')
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reasonById, setReasonById] = useState<Record<number, string>>({})

  async function load(status: SubmissionStatus = activeStatus) {
    setError(null)
    try {
      const [me, data] = await Promise.all([api.me(), api.adminSubmissions(status)])
      setUser(me)
      setSubmissions(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load admin submissions.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let ignore = false
    api
      .me()
      .then(async (me) => {
        const data = await api.adminSubmissions(activeStatus)
        if (!ignore) {
          setUser(me)
          setSubmissions(data)
        }
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
  }, [activeStatus])

  async function moderate(id: number, action: 'approve' | 'reject') {
    setError(null)
    try {
      if (action === 'approve') {
        await api.approveSubmission(id)
      } else {
        await api.rejectSubmission(id, reasonById[id])
      }
      setLoading(true)
      await load(activeStatus)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Moderation failed.')
    }
  }

  return (
    <PageShell eyebrow="Admin" title="Manage CyOps submissions." intro="Participant submissions stay hidden until an approved admin moves them into the public gallery.">
      <div className="mb-6 flex flex-wrap gap-3">
        {statuses.map((status) => (
          <button key={status} className={activeStatus === status ? 'cy-button' : 'cy-button-secondary'} onClick={() => { setLoading(true); setActiveStatus(status) }}>
            {status}
          </button>
        ))}
      </div>
      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}
      {!loading && user && !user.is_admin ? <ErrorState message="Admin access requires a connected X account listed in ADMIN_X_USERNAMES." /> : null}
      <div className="grid gap-6">
        {submissions.map((submission) => {
          const canApprove = submission.status === 'pending'
          const canReject = submission.status !== 'rejected'

          return (
            <article key={submission.id} className="cy-card grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
              <div className="min-w-0">
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <StatusPill status={submission.status} />
                  <span className="text-sm text-slate-400">{submission.participant_name}</span>
                </div>
                <h2 className="text-2xl font-bold text-white">{submission.project_title || 'Untitled CyOps Project'}</h2>
                {submission.description ? <p className="mt-3 text-sm leading-6 text-slate-300">{submission.description}</p> : null}
                <p className="mt-3 break-all font-mono text-xs text-cyan">{submission.tweet_url}</p>
                {submission.rejection_reason ? <p className="mt-3 rounded-lg border border-rose-300/20 bg-rose-500/10 p-3 text-sm text-rose-100">{submission.rejection_reason}</p> : null}
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <Link className="cy-button-secondary" href={`/admin/submissions/${submission.id}`}>Open admin detail</Link>
                  {canApprove ? <button className="cy-button" onClick={() => moderate(submission.id, 'approve')}>Approve</button> : null}
                  {canReject ? <button className="cy-button-secondary border-rose-300/30 hover:border-rose-300/50" onClick={() => moderate(submission.id, 'reject')}>Reject</button> : null}
                </div>
                {canReject ? (
                  <label className="mt-4 grid gap-2">
                    <span className="cy-label">Optional rejection reason</span>
                    <input className="cy-input" value={reasonById[submission.id] || ''} onChange={(event) => setReasonById({ ...reasonById, [submission.id]: event.target.value })} placeholder="Reason shared in admin records" />
                  </label>
                ) : null}
              </div>
              <div className="min-w-0 rounded-lg border border-white/10 bg-black/25 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Tweet</p>
                <p className="mt-2 break-all font-mono text-sm text-snow">{submission.tweet_id}</p>
                <div className="mt-4 rounded-lg border border-lime/30 bg-lime/10 p-3 text-center">
                  <p className="font-mono text-2xl font-black text-lime">{submission.vote_count}</p>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">votes</p>
                </div>
                <a className="cy-button-secondary mt-4 w-full" href={submission.tweet_url} target="_blank" rel="noreferrer">
                  Open X post
                </a>
              </div>
            </article>
          )
        })}
      </div>
    </PageShell>
  )
}

