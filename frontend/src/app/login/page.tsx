'use client'

import { useEffect, useState } from 'react'
import { ErrorState } from '@/components/ErrorState'
import { PageShell } from '@/components/PageShell'
import { api } from '@/lib/api'
import type { User } from '@/lib/types'

const ENABLE_DEV_AUTH_MOCKS = process.env.NEXT_PUBLIC_ENABLE_DEV_AUTH_MOCKS === 'true'

export default function LoginPage() {
  const [user, setUser] = useState<User | null>(null)
  const [displayName, setDisplayName] = useState('CyOps Voter')
  const [xUsername, setXUsername] = useState('cyops_team')
  const [discordUsername, setDiscordUsername] = useState('cyops.builder')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    api.me().then(setUser).catch(() => setUser(null))

    const search = new URLSearchParams(window.location.search)
    const oauth = search.get('oauth')
    const reason = search.get('reason')
    const stage = search.get('stage')
    const status = search.get('status')
    const messages: Record<string, string> = {
      'x-not-configured': ENABLE_DEV_AUTH_MOCKS
        ? 'X OAuth is not configured locally. Use the mock login and mock link X controls below, or set X_CLIENT_ID and X_CLIENT_SECRET.'
        : 'X OAuth is not configured.',
      'discord-not-configured': ENABLE_DEV_AUTH_MOCKS
        ? 'Discord OAuth is not configured locally. Use the mock login and mock link Discord controls below, or set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET.'
        : 'Discord OAuth is not configured.',
      'x-success': 'X account connected successfully.',
      'discord-success': 'Discord account connected successfully.',
      'x-error':
        reason === 'state-mismatch'
          ? 'X OAuth state validation failed. Start the login flow again.'
          : stage && status
            ? `X OAuth failed during ${stage} step (${status}).`
            : 'X OAuth failed to complete.',
      'discord-error':
        reason === 'state-mismatch'
          ? 'Discord OAuth state validation failed. Start the login flow again.'
          : stage && status
            ? `Discord OAuth failed during ${stage} step (${status}).`
            : 'Discord OAuth failed to complete.',
      'x-placeholder': 'X OAuth callback placeholder reached. Wire the production token exchange when real credentials are ready.',
      'discord-placeholder': 'Discord OAuth callback placeholder reached. Wire the production token exchange when real credentials are ready.',
    }
    if (oauth && messages[oauth]) {
      window.requestAnimationFrame(() => setNotice(messages[oauth]))
    }
  }, [])

  async function run(action: () => Promise<User | { message: string }>) {
    setError(null)
    try {
      await action()
      window.dispatchEvent(new Event('cyops-auth-change'))
      api.me().then(setUser).catch(() => setUser(null))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.')
    }
  }

  return (
    <PageShell
      eyebrow="Verification"
      title="Connect both networks before voting."
      intro={
        ENABLE_DEV_AUTH_MOCKS
          ? 'Verify X and Discord, then cast one vote for a CyOps submission. Mock controls let local teams test the verification and admin flow immediately.'
          : 'Verify X and Discord, then cast one vote for a CyOps submission.'
      }
    >
      <div className="mx-auto max-w-3xl">
        <div className="cy-card grid gap-4 p-4 sm:p-5">
          {notice ? <div className="rounded-lg border border-cyan/30 bg-cyan/10 p-4 text-sm leading-6 text-cyan">{notice}</div> : null}
          {ENABLE_DEV_AUTH_MOCKS ? (
            <div className="grid gap-3">
              <h2 className="text-lg font-bold text-white">Development mock verification</h2>
              <label className="grid gap-1.5">
                <span className="cy-label">Display name</span>
                <input className="cy-input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
              </label>
              <button className="cy-button-secondary" onClick={() => run(() => api.mockLogin(displayName))}>Mock login</button>
              <label className="grid gap-1.5">
                <span className="cy-label">X username</span>
                <input className="cy-input" value={xUsername} onChange={(event) => setXUsername(event.target.value)} />
              </label>
              <button className="cy-button-secondary" onClick={() => run(() => api.mockLinkX(xUsername))}>Mock link X</button>
              <label className="grid gap-1.5">
                <span className="cy-label">Discord username</span>
                <input className="cy-input" value={discordUsername} onChange={(event) => setDiscordUsername(event.target.value)} />
              </label>
              <button className="cy-button-secondary" onClick={() => run(() => api.mockLinkDiscord(discordUsername))}>Mock link Discord</button>
            </div>
          ) : (
            <div className="text-sm leading-6 text-slate-300">
              Use X and Discord OAuth to verify the account before voting.
            </div>
          )}
          {error ? <ErrorState message={error} /> : null}
          {user ? <button className="cy-button-secondary mt-2 w-full sm:w-auto" onClick={() => run(() => api.logout())}>Logout</button> : null}
        </div>
      </div>
    </PageShell>
  )
}

