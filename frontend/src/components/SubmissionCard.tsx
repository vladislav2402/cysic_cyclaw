'use client'

import clsx from 'clsx'
import Link from 'next/link'
import { TweetAuthorBadge } from '@/components/TweetAuthorBadge'
import { submissionPublicPath, submissionTweetUsername } from '@/lib/tweet'
import type { Submission } from '@/lib/types'

type SubmissionCardProps = {
  submission: Submission
  dropNumber: number
}

function formatDropNumber(value: number) {
  return value.toString().padStart(2, '0')
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Recently added'
  }
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date)
}

function shortTweetId(tweetId: string) {
  if (tweetId.length <= 10) return tweetId
  return `${tweetId.slice(0, 6)}...${tweetId.slice(-4)}`
}

export function SubmissionCard({ submission, dropNumber }: SubmissionCardProps) {
  const safeDropNumber = Math.max(dropNumber, 1)
  const tweetUsername = submissionTweetUsername(submission)
  const publicPath = submissionPublicPath(submission)
  const summary = submission.description?.trim() || 'Project summary will appear here once the author adds details.'

  return (
    <Link
      href={publicPath}
      data-submission-card={submission.id}
      aria-label={`Open ${submission.project_title?.trim() || tweetUsername || 'project'} submission`}
      className={clsx(
        'cy-tile-enter group relative flex min-w-0 aspect-square overflow-hidden rounded-lg border border-white/10 bg-white/[0.045] text-left shadow-lift backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-1 hover:border-cyan/30 hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-cyan/50',
      )}
      style={{ animationDelay: `${Math.min((safeDropNumber - 1) * 45, 360)}ms` }}
    >
      <div
        className={clsx(
          'pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(124,58,237,0.14),transparent_36%)] transition-opacity duration-300',
          'opacity-0 group-hover:opacity-100',
        )}
      />

      <div className="relative z-10 grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-4 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-cyan/20 bg-cyan/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan">
                Drop #{formatDropNumber(safeDropNumber)}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                Tweet {shortTweetId(submission.tweet_id)}
              </span>
            </div>

            <TweetAuthorBadge tweetUrl={submission.tweet_url} />
          </div>

          <div className="hidden shrink-0 items-start text-right sm:flex">
            <div className="space-y-1 rounded-lg border border-white/10 bg-black/20 px-4 py-3">
              <p className="text-2xl font-black text-cyan">{submission.vote_count}</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Votes</p>
            </div>
          </div>
        </div>

        <div className="min-h-0 overflow-hidden">
          <h2 className="font-heading text-2xl font-black uppercase tracking-[0.03em] text-white [display:-webkit-box] overflow-hidden [-webkit-box-orient:vertical] [-webkit-line-clamp:2] sm:text-[2rem]">
            {submission.project_title?.trim() || tweetUsername || 'Community drop'}
          </h2>
          <p
            className={clsx(
              'mt-3 min-w-0 text-sm leading-7 text-slate-300',
              '[display:-webkit-box] overflow-hidden [-webkit-box-orient:vertical] [-webkit-line-clamp:4]',
            )}
          >
            {summary}
          </p>
        </div>

        <div className="border-t border-white/10 pt-4 text-xs uppercase tracking-[0.18em] text-slate-400">
          <div className="flex items-center justify-between gap-3">
            <span className="shrink-0">{formatDate(submission.created_at)}</span>
            <span className="hidden min-w-0 truncate text-slate-500 sm:block">{submission.discord_handle || ''}</span>
            <span className="shrink-0 font-semibold text-slate-500 transition-colors duration-300 group-hover:text-cyan">Open project</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
