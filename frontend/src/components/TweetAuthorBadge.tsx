'use client'

import Image from 'next/image'
import { useState } from 'react'
import { parseTweetUrl, tweetAvatarUrl } from '@/lib/tweet'

export function TweetAuthorBadge({ tweetUrl }: { tweetUrl: string }) {
  const [avatarFailed, setAvatarFailed] = useState(false)
  const tweet = parseTweetUrl(tweetUrl)
  const initials = tweet.username.slice(0, 2).toUpperCase() || 'X'

  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-cyan/30 bg-cyan/10 font-heading text-xs text-cyan">
        {tweet.username && !avatarFailed ? (
          <Image
            src={tweetAvatarUrl(tweet.username)}
            alt={`${tweet.author} avatar`}
            width={32}
            height={32}
            className="h-full w-full object-cover"
            unoptimized
            onError={() => setAvatarFailed(true)}
          />
        ) : (
          initials
        )}
      </div>
      <p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-cyan">{tweet.author}</p>
    </div>
  )
}
