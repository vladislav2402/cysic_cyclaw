'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { ErrorState } from '@/components/ErrorState'
import { PageShell } from '@/components/PageShell'
import { api } from '@/lib/api'
import type { User } from '@/lib/types'

const tweetPattern = /^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/[A-Za-z0-9_]{1,20}\/status\/\d+(?:[/?#].*)?$/

export default function SubmitPage() {
  const [form, setForm] = useState({
    project_title: '',
    tweet_url: '',
    discord_handle: '',
    description: '',
  })
  const [user, setUser] = useState<User | null>(null)
  const [loadingUser, setLoadingUser] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const canSubmit = Boolean(user?.x_account && user?.discord_account && !user?.submitted_submission_id)

  useEffect(() => {
    api
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoadingUser(false))
  }, [])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting || loadingUser) return
    setError(null)
    setSuccess(null)
    if (!user?.x_account) {
      setError('Connect X/Twitter before submitting a project.')
      return
    }
    if (!user.discord_account) {
      setError('Connect Discord before submitting a project.')
      return
    }
    if (user.submitted_submission_id) {
      setError('You already have a submission waiting for review or published.')
      return
    }
    if (!tweetPattern.test(form.tweet_url.trim())) {
      setError('Enter a valid X/Twitter status URL like https://x.com/name/status/1234567890.')
      return
    }
    setSubmitting(true)
    try {
      const tweetUrl = form.tweet_url.trim()
      const result = await api.createSubmission({
        project_title: form.project_title.trim() || undefined,
        tweet_url: tweetUrl,
        discord_handle: user.discord_account.username,
        description: form.description.trim() || undefined,
      })
      setUser((currentUser) => currentUser ? { ...currentUser, submitted_submission_id: result.id } : currentUser)
      setSuccess(`${result.message} Tweet ID ${result.tweet_id} is pending approval.`)
      setForm({ project_title: '', tweet_url: '', discord_handle: '', description: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageShell eyebrow="Project Submit" title="Submit a CyOps project." intro="Connect both X/Twitter and Discord before sending one project post for admin review.">
      <form onSubmit={onSubmit} className="cy-card grid gap-5 p-5 sm:p-7 lg:max-w-3xl">
        <div className="grid gap-3 rounded-lg border border-white/10 bg-black/25 p-4 sm:grid-cols-3">
          <div>
            <p className="cy-label">X/Twitter account</p>
            <p className="mt-1 font-mono text-sm text-snow">{loadingUser ? 'Loading session...' : user?.x_account ? `@${user.x_account.username}` : 'Connect X/Twitter'}</p>
          </div>
          <div>
            <p className="cy-label">Discord account</p>
            <p className="mt-1 font-mono text-sm text-snow">{loadingUser ? 'Loading session...' : user?.discord_account ? user.discord_account.username : 'Connect Discord'}</p>
          </div>
          <div>
            <p className="cy-label">Review status</p>
            <p className="mt-1 font-mono text-sm text-snow">{loadingUser ? 'Checking session...' : user?.submitted_submission_id ? 'Already submitted' : 'Ready for review queue'}</p>
          </div>
          {!loadingUser && (!user?.x_account || !user.discord_account) ? (
            <div className="sm:col-span-3">
              <Link href="/login" className="cy-button-secondary w-full">
                Connect required accounts
              </Link>
            </div>
          ) : null}
          {!loadingUser && user?.submitted_submission_id ? (
            <div className="sm:col-span-3 rounded-lg border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
              Your submission is already in the system. Pending submissions become public after approval.
            </div>
          ) : null}
        </div>
        <label className="grid gap-2">
          <span className="cy-label">Project title</span>
          <input className="cy-input" value={form.project_title} onChange={(event) => setForm({ ...form, project_title: event.target.value })} placeholder="Proof engine, dashboard, game, bot..." />
        </label>
        <label className="grid gap-2">
          <span className="cy-label">X/Twitter post URL</span>
          <input className="cy-input" required value={form.tweet_url} onChange={(event) => setForm({ ...form, tweet_url: event.target.value })} placeholder="https://x.com/username/status/1234567890" />
        </label>
        <label className="grid gap-2">
          <span className="cy-label">Discord handle</span>
          <input className="cy-input" value={user?.discord_account?.username || form.discord_handle} onChange={(event) => setForm({ ...form, discord_handle: event.target.value })} disabled={Boolean(user?.discord_account)} placeholder="Connect Discord to fill this automatically" />
        </label>
        <label className="grid gap-2">
          <span className="cy-label">Project description</span>
          <textarea className="cy-input min-h-36 resize-y" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What did you build, and why should the CyOps community care?" />
        </label>
        {error ? <ErrorState message={error} /> : null}
        {success ? <div className="rounded-lg border border-lime/30 bg-lime/10 p-4 text-lime">{success}</div> : null}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="submit" className="cy-button" disabled={submitting || loadingUser || !canSubmit}>
            {submitting ? 'Submitting...' : 'Submit for review'}
          </button>
          <Link href="/" className="cy-button-secondary">
            Back to gallery
          </Link>
        </div>
      </form>
    </PageShell>
  )
}

