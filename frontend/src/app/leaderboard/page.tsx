'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ErrorState } from '@/components/ErrorState'
import { LoadingState } from '@/components/LoadingState'
import { PageShell } from '@/components/PageShell'
import { api } from '@/lib/api'
import { submissionPublicPath } from '@/lib/tweet'
import type { Submission } from '@/lib/types'

export default function LeaderboardPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.leaderboard().then(setSubmissions).catch((err: Error) => setError(err.message)).finally(() => setLoading(false))
  }, [])

  return (
    <PageShell eyebrow="Leaderboard" title="ONLY THE BEST RISE TO THE TOP." intro="See the highest-ranked CyOps demos, powered by verified community votes. Track the leaders and discover the most impressive submissions.">
      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}
      <div className="grid gap-4">
        {submissions.map((submission, index) => {
          const rank = index + 1
          const highlight = rank <= 3 ? 'border-lime/30 bg-lime/[0.08]' : ''
          return (
            <Link key={submission.id} href={submissionPublicPath(submission)} className={`cy-card grid gap-4 p-5 transition hover:-translate-y-0.5 hover:border-cyan/30 sm:grid-cols-[5rem_minmax(0,1fr)_8rem] sm:items-center ${highlight}`}>
              <div className="font-mono text-3xl font-black text-cyan">#{rank}</div>
              <div className="min-w-0">
                <p className="truncate text-sm uppercase tracking-[0.18em] text-slate-400">{submission.participant_name}</p>
                <h2 className="truncate text-xl font-bold text-white">{submission.project_title || 'Untitled CyOps Project'}</h2>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/25 p-3 text-center">
                <p className="font-mono text-2xl font-black text-lime">{submission.vote_count}</p>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">votes</p>
              </div>
            </Link>
          )
        })}
      </div>
    </PageShell>
  )
}

