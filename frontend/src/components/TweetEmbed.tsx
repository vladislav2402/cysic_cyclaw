'use client'

import { useEffect, useRef, useState } from 'react'

export function TweetEmbed({ id, url, compact = false }: { id: string; url?: string; compact?: boolean }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    const container = containerRef.current

    if (!container) {
      return
    }

    container.innerHTML = ''
    setState('loading')

    void (async () => {
      try {
        await loadXWidgets()
        if (cancelled || !containerRef.current || !window.twttr?.widgets?.createTweet) {
          return
        }

        containerRef.current.innerHTML = ''
        await window.twttr.widgets.createTweet(id, containerRef.current, {
          theme: 'dark',
          dnt: true,
          align: 'center',
          conversation: compact ? 'none' : undefined,
        })

        if (!cancelled) {
          setState('ready')
        }
      } catch (error) {
        console.error('Tweet embed failed.', error)
        if (containerRef.current) {
          containerRef.current.innerHTML = ''
        }
        if (!cancelled) {
          setState('error')
        }
      }
    })()

    return () => {
      cancelled = true
      if (container) {
        container.innerHTML = ''
      }
    }
  }, [compact, id])

  return (
    <div className={`tweet-shell relative overflow-hidden rounded-lg border border-white/10 bg-[#15202b] ${compact ? 'max-h-72 overflow-y-auto' : ''}`}>
      <div ref={containerRef} className={state === 'error' ? 'hidden' : 'flex justify-center bg-[#15202b]'} />
      {state === 'loading' ? (
        <div className="absolute inset-0 flex min-h-[20rem] items-center justify-center bg-[#15202b] p-6 text-center text-sm text-slate-400">
          Loading post embed...
        </div>
      ) : null}
      {state === 'error' ? (
        <div className="rounded-lg border border-white/10 bg-black/25 p-5 text-sm text-slate-300">
          <p className="font-semibold text-white">Tweet embed unavailable.</p>
          <p className="mt-2 leading-6 text-slate-400">This post could not be rendered by the official X widget.</p>
          {url ? (
            <a className="cy-button-secondary mt-4 inline-flex" href={url} target="_blank" rel="noreferrer">
              Open X post
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

declare global {
  interface Window {
    twttr?: {
      widgets?: {
        createTweet: (
          tweetId: string,
          target: HTMLElement,
          options?: Record<string, unknown>,
        ) => Promise<HTMLElement>
      }
    }
  }
}

let xWidgetsPromise: Promise<void> | null = null

async function loadXWidgets() {
  if (typeof window === 'undefined') {
    return
  }

  if (window.twttr?.widgets?.createTweet) {
    return
  }

  if (!xWidgetsPromise) {
    xWidgetsPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-x-widgets="true"]')

      const finish = () => {
        waitForXWidgets().then(resolve).catch(reject)
      }

      if (existing) {
        finish()
        return
      }

      const script = document.createElement('script')
      script.src = 'https://platform.twitter.com/widgets.js'
      script.async = true
      script.dataset.xWidgets = 'true'
      script.onload = finish
      script.onerror = () => reject(new Error('Failed to load X widgets.'))
      document.head.appendChild(script)
    })
  }

  return xWidgetsPromise
}

function waitForXWidgets() {
  return new Promise<void>((resolve, reject) => {
    let attempts = 0

    const tick = () => {
      if (window.twttr?.widgets?.createTweet) {
        resolve()
        return
      }

      attempts += 1
      if (attempts > 80) {
        reject(new Error('X widgets did not initialize in time.'))
        return
      }

      window.setTimeout(tick, 50)
    }

    tick()
  })
}
