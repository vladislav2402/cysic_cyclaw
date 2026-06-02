import type { Submission } from './types'

const RESERVED_PUBLIC_SLUGS = new Set(['admin', 'api', 'leaderboard', 'login', 'submit', 'submissions'])

export function parseTweetUrl(url: string) {
  const match = url.match(/^https?:\/\/(?:www\.)?(x|twitter)\.com\/([A-Za-z0-9_]{1,20})\/status\/(\d+)/)
  const username = match?.[2] || ''

  return {
    username,
    author: username ? `@${username}` : 'X post',
    source: match?.[1] === 'twitter' ? 'twitter.com' : 'x.com',
    tweetId: match?.[3] || '',
  }
}

export function tweetAvatarUrl(username: string) {
  return `https://unavatar.io/x/${username}`
}

export function submissionTweetUsername(submission: Submission) {
  return submission.tweet_username || parseTweetUrl(submission.tweet_url).username
}

export function submissionPublicPath(submission: Submission) {
  const username = submissionTweetUsername(submission)
  if (!username || RESERVED_PUBLIC_SLUGS.has(username.toLowerCase())) {
    return `/submissions/${submission.id}`
  }
  return `/${username}`
}
