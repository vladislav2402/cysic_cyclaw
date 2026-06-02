'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { api, loginUrl } from '@/lib/api'
import type { User } from '@/lib/types'

const nav = [
  { href: '/', label: 'Gallery' },
  { href: '/submit', label: 'Submit' },
  { href: '/leaderboard', label: 'Leaderboard' },
]

const APP_ICON = '/icon.svg'

export function Header() {
  const [user, setUser] = useState<User | null>(null)
  const [open, setOpen] = useState(false)
  const [disconnectingX, setDisconnectingX] = useState(false)
  const [disconnectingDiscord, setDisconnectingDiscord] = useState(false)

  useEffect(() => {
    const refresh = () => api.me().then(setUser).catch(() => setUser(null))
    refresh()
    window.addEventListener('cyops-auth-change', refresh)
    return () => window.removeEventListener('cyops-auth-change', refresh)
  }, [])

  const links = user?.is_admin ? [...nav, { href: '/admin/submissions', label: 'Admin' }] : nav
  const xLabel = user?.x_account ? 'Disconnect X' : 'Connect X'
  const discordLabel = user?.discord_account ? 'Disconnect Discord' : 'Connect Discord'

  async function handleXClick() {
    if (!user?.x_account) {
      window.location.href = loginUrl('x')
      return
    }
    if (disconnectingX) return
    setDisconnectingX(true)
    try {
      const updatedUser = await api.logoutX()
      setUser(updatedUser)
      window.dispatchEvent(new Event('cyops-auth-change'))
    } catch {
      // Keep the current state when the disconnect request fails.
    } finally {
      setDisconnectingX(false)
    }
  }

  async function handleDiscordClick() {
    if (!user?.discord_account) {
      window.location.href = loginUrl('discord')
      return
    }
    if (disconnectingDiscord) return
    setDisconnectingDiscord(true)
    try {
      const updatedUser = await api.logoutDiscord()
      setUser(updatedUser)
      window.dispatchEvent(new Event('cyops-auth-change'))
    } catch {
      // Keep the current state when the disconnect request fails.
    } finally {
      setDisconnectingDiscord(false)
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-void/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-5 lg:px-7">
        <Link href="/" prefetch={false} className="flex min-w-0 items-center gap-3">
          <Image src={APP_ICON} alt="CyOps" width={32} height={32} className="h-8 w-8 shrink-0 rounded-lg shadow-glow" />
          <span className="font-heading truncate text-xs font-black uppercase tracking-[0.2em] text-snow sm:text-sm">CyOps Showcase</span>
        </Link>

        <nav className="hidden items-center gap-1.5 md:flex">
          {links.map((item) => (
            <Link key={item.href} href={item.href} prefetch={false} className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white">
              {item.label}
            </Link>
          ))}
          <div className="ml-2 flex items-center gap-2">
            <button type="button" onClick={handleXClick} disabled={disconnectingX} className={user?.x_account ? 'cy-button-secondary' : 'cy-button'} title={user?.x_account ? 'Disconnect X' : 'Connect X'}>
              {disconnectingX ? 'Disconnecting...' : xLabel}
            </button>
            <button
              type="button"
              onClick={handleDiscordClick}
              disabled={disconnectingDiscord}
              className="cy-button-secondary"
              title={user?.discord_account ? 'Disconnect Discord' : 'Connect Discord'}
            >
              {disconnectingDiscord ? 'Disconnecting...' : discordLabel}
            </button>
          </div>
        </nav>

        <button className="cy-button-secondary px-3 md:hidden" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Toggle navigation">
          Menu
        </button>
      </div>
      {open ? (
        <div className="border-t border-white/10 px-4 pb-3 md:hidden">
          <div className="grid gap-1.5">
            {links.map((item) => (
              <Link key={item.href} href={item.href} prefetch={false} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-200 hover:bg-white/10" onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                void handleXClick()
              }}
              disabled={disconnectingX}
              className={user?.x_account ? 'cy-button-secondary justify-center' : 'cy-button justify-center'}
              title={user?.x_account ? 'Disconnect X' : 'Connect X'}
            >
              {disconnectingX ? 'Disconnecting...' : xLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                void handleDiscordClick()
              }}
              disabled={disconnectingDiscord}
              className="cy-button-secondary justify-center"
              title={user?.discord_account ? 'Disconnect Discord' : 'Connect Discord'}
            >
              {disconnectingDiscord ? 'Disconnecting...' : discordLabel}
            </button>
          </div>
        </div>
      ) : null}
    </header>
  )
}
