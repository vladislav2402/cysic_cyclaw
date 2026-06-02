'use client'

import { useEffect, useMemo, useState } from 'react'
import { ErrorState } from '@/components/ErrorState'
import { LoadingState } from '@/components/LoadingState'
import { PageShell } from '@/components/PageShell'
import { SubmissionCard } from '@/components/SubmissionCard'
import { api } from '@/lib/api'
import type { Submission } from '@/lib/types'

type SortMode = 'earliest' | 'latest' | 'votes'

export default function HomePage() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('earliest')
  const [query, setQuery] = useState('')

  useEffect(() => {
    api
      .submissions()
      .then((submissionData) => {
        setSubmissions(submissionData)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const earliestDropNumbers = useMemo(() => {
    const ordered = [...submissions].sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime())
    return new Map(ordered.map((submission, index) => [submission.id, index + 1]))
  }, [submissions])

  const visibleSubmissions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const filtered = submissions.filter((submission) => {
      if (!normalizedQuery) return true
      return [submission.project_title, submission.participant_name, submission.tweet_username, submission.description]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedQuery))
    })

    return filtered.sort((left, right) => {
      const leftCreated = new Date(left.created_at).getTime()
      const rightCreated = new Date(right.created_at).getTime()

      if (sortMode === 'votes') {
        if (right.vote_count !== left.vote_count) {
          return right.vote_count - left.vote_count
        }
        return leftCreated - rightCreated
      }

      if (sortMode === 'latest') {
        return rightCreated - leftCreated
      }

      return leftCreated - rightCreated
    })
  }, [query, sortMode, submissions])

  return (
    <PageShell
      eyebrow="Competition Hub"
      title="CyOps demos, shipped by the community."
      intro="Browse the feed as compact drop tiles and open any square to move into the full project page before voting."
    >
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {[
          ['Approved projects', submissions.length.toString()],
          ['Vote rule', '1 / verified user'],
          ['Access', 'X + Discord'],
        ].map(([label, value]) => (
          <div key={label} className="cy-card p-5">
            <p className="text-sm text-slate-400">{label}</p>
            <p className="mt-2 text-2xl font-black text-white">{value}</p>
          </div>
        ))}
      </div>

      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}

      {!loading && !error ? (
        <>
          <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="cy-card p-5">
              <p className="text-sm font-medium text-slate-300">Browse projects in the order they were approved.</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">Use search to find a builder, or switch the sort when you want the newest or most-voted projects first.</p>
            </div>

            <label className="cy-card block p-4">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Find a handle or title</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="@cysic_xyz or VS Code plugin"
                className="cy-input"
              />
            </label>
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {([
              ['earliest', 'Earliest first'],
              ['latest', 'Newest first'],
              ['votes', 'Top voted'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setSortMode(value)}
                className={value === sortMode ? 'cy-button' : 'cy-button-secondary'}
              >
                {label}
              </button>
            ))}
          </div>

          {submissions.length === 0 ? <div className="cy-card p-8 text-center text-slate-300">No submissions yet.</div> : null}
          {submissions.length > 0 && visibleSubmissions.length === 0 ? (
            <div className="cy-card p-8 text-center text-slate-300">No submissions match the current search.</div>
          ) : null}

          <div className="grid min-w-0 auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleSubmissions.map((submission) => (
              <SubmissionCard key={submission.id} submission={submission} dropNumber={earliestDropNumbers.get(submission.id) ?? 0} />
            ))}
          </div>
        </>
      ) : null}
    </PageShell>
  )
}
