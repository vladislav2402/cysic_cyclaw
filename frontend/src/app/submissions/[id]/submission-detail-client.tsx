'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ErrorState } from '@/components/ErrorState'
import { PageShell } from '@/components/PageShell'
import { TweetEmbed } from '@/components/TweetEmbed'
import { api } from '@/lib/api'
import { submissionTweetUsername } from '@/lib/tweet'
import type { Submission, User } from '@/lib/types'

export function SubmissionDetailClient({
  initialSubmission,
}: {
  initialSubmission: Submission
}) {
  const [submission, setSubmission] = useState<Submission>(initialSubmission)
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [voting, setVoting] = useState(false)

  useEffect(() => {
    let ignore = false

    api
      .me()
      .then((currentUser) => {
        if (!ignore) {
          setUser(currentUser)
        }
      })
      .catch(() => {
        if (!ignore) {
          setUser(null)
        }
      })

    return () => {
      ignore = true
    }
  }, [])

  async function toggleVote() {
    setError(null)
    setMessage(null)
    if (user === undefined) {
      setError('Checking account status. Try again in a moment.')
      return
    }
    if (!user) {
      setError('Connect X and Discord before voting.')
      return
    }
    const votedHere = user.voted_submission_id === submission.id
    const voteUsedElsewhere = user.voted_submission_id !== null && user.voted_submission_id !== undefined && !votedHere
    if (!votedHere && !user.is_verified) {
      setError('Connect both X/Twitter and Discord before voting.')
      return
    }
    if (voteUsedElsewhere) {
      setError('You have already voted for another submission. Retract that vote before choosing a new project.')
      return
    }
    setVoting(true)
    try {
      const result = votedHere ? await api.retractVote(submission.id) : await api.vote(submission.id)
      setSubmission((current) => (current ? { ...current, vote_count: result.vote_count } : current))
      setUser({ ...user, voted_submission_id: votedHere ? null : submission.id })
      setMessage(votedHere ? 'Vote retracted.' : 'Vote recorded.')
    } catch (err) {
      setError(err instanceof Error ? err.message : votedHere ? 'Vote retract failed.' : 'Vote failed.')
    } finally {
      setVoting(false)
    }
  }

  const votedHere = user?.voted_submission_id === submission.id
  const voteUsedElsewhere = user?.voted_submission_id !== null && user?.voted_submission_id !== undefined && !votedHere
  const checkingAccess = user === undefined
  const tweetUsername = submissionTweetUsername(submission)
  const eyebrow = tweetUsername ? `@${tweetUsername}` : submission.participant_name

  return (
    <PageShell eyebrow={eyebrow} title={submission.project_title || 'Untitled CyOps Project'} intro={submission.description || 'Project details are carried by the embedded X/Twitter post.'}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          <TweetEmbed id={submission.tweet_id} url={submission.tweet_url} />
        </div>
        <aside className="cy-card h-fit p-5">
          <div className="rounded-lg border border-lime/30 bg-lime/10 p-5 text-center">
            <p className="font-mono text-5xl font-black text-lime">{submission.vote_count}</p>
            <p className="text-sm uppercase tracking-[0.18em] text-slate-300">votes</p>
          </div>
          <dl className="mt-5 grid gap-4 text-sm">
            <div>
              <dt className="text-slate-500">X post</dt>
              <dd className="break-all text-cyan">{submission.tweet_url}</dd>
            </div>
            {submission.discord_handle ? (
              <div>
                <dt className="text-slate-500">Discord</dt>
                <dd className="text-white">{submission.discord_handle}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-slate-500">Verification</dt>
              <dd className="text-white">{checkingAccess ? 'Checking account status' : user?.is_verified ? 'X and Discord connected' : 'Connect X and Discord to vote'}</dd>
            </div>
          </dl>
          {error ? <div className="mt-5"><ErrorState message={error} /></div> : null}
          {message ? <div className="mt-5 rounded-lg border border-lime/30 bg-lime/10 p-4 text-lime">{message}</div> : null}
          <button className="cy-button mt-5 w-full" onClick={toggleVote} disabled={checkingAccess || voting || voteUsedElsewhere}>
            {checkingAccess
              ? 'Checking access...'
              : voting
                ? (votedHere ? 'Retracting...' : 'Voting...')
                : votedHere
                  ? 'Retract vote'
                  : voteUsedElsewhere
                    ? 'Vote already used'
                    : 'Vote for this project'}
          </button>
          {user !== undefined && !user?.is_verified ? (
            <Link href="/login" prefetch={false} className="cy-button-secondary mt-3 w-full">
              Verify accounts
            </Link>
          ) : null}
        </aside>
      </div>
    </PageShell>
  )
}

