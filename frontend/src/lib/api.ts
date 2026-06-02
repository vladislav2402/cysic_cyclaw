import type { Submission, SubmissionStatus, User } from './types'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''
const REQUEST_TIMEOUT_MS = 15000
const ME_CACHE_TTL_MS = 30000

type RequestOptions = RequestInit & {
  json?: unknown
}

type MeRequestOptions = {
  force?: boolean
}

function cleanHandle(value: string | number) {
  return String(value).trim().replace(/^@/, '')
}

function submissionLookupPath(value: string | number) {
  const cleaned = cleanHandle(value)
  if (/^\d+$/.test(cleaned)) {
    return `/submissions/${cleaned}`
  }
  return `/submissions/by-handle/${encodeURIComponent(cleaned)}`
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

let meCacheValue: User | null | undefined
let meCacheExpiresAt = 0
let meInflight: Promise<User | null> | null = null

function setMeCache(value: User | null) {
  meCacheValue = value
  meCacheExpiresAt = Date.now() + ME_CACHE_TTL_MS
}

function clearMeCache() {
  meCacheValue = undefined
  meCacheExpiresAt = 0
  meInflight = null
}

async function requestMe(options: MeRequestOptions = {}): Promise<User | null> {
  if (!options.force && meCacheValue !== undefined && meCacheExpiresAt > Date.now()) {
    return meCacheValue
  }

  if (!options.force && meInflight) {
    return meInflight
  }

  meInflight = request<User | null>('/auth/me')
    .then((user) => {
      setMeCache(user)
      return user
    })
    .catch((error) => {
      clearMeCache()
      throw error
    })
    .finally(() => {
      meInflight = null
    })

  return meInflight
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.json !== undefined) {
    headers.set('Content-Type', 'application/json')
  }
  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      ...options,
      headers,
      credentials: 'include',
      body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('Request timed out. Check that the backend is running and try again.', 408)
    }
    throw error
  } finally {
    globalThis.clearTimeout(timeout)
  }
  if (!response.ok) {
    let message = `Request failed with status ${response.status}.`
    try {
      const data = (await response.json()) as { detail?: string }
      if (data.detail) message = data.detail
    } catch {
      // Keep the generic message when the backend does not return JSON.
    }
    throw new ApiError(message, response.status)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const api = {
  me: (options?: MeRequestOptions) => requestMe(options),
  logout: async () => {
    const result = await request<{ message: string }>('/auth/logout', { method: 'POST' })
    clearMeCache()
    return result
  },
  logoutX: async () => {
    const user = await request<User>('/auth/x/logout', { method: 'POST' })
    setMeCache(user)
    return user
  },
  logoutDiscord: async () => {
    const user = await request<User>('/auth/discord/logout', { method: 'POST' })
    setMeCache(user)
    return user
  },
  submissions: () => request<Submission[]>('/submissions'),
  submission: (idOrHandle: string | number) => request<Submission>(submissionLookupPath(idOrHandle)),
  createSubmission: (payload: {
    project_title?: string
    tweet_url: string
    discord_handle?: string
    description?: string
  }) => request<{ id: number; status: SubmissionStatus; tweet_id: string; message: string }>('/submissions', { method: 'POST', json: payload }).then((result) => {
    if (meCacheValue) {
      setMeCache({ ...meCacheValue, submitted_submission_id: result.id })
    } else {
      clearMeCache()
    }
    return result
  }),
  leaderboard: () => request<Submission[]>('/leaderboard'),
  vote: async (id: string | number) => {
    const result = await request<{ submission_id: number; vote_count: number }>(`/submissions/${id}/vote`, { method: 'POST' })
    if (meCacheValue) {
      setMeCache({ ...meCacheValue, voted_submission_id: result.submission_id })
    } else {
      clearMeCache()
    }
    return result
  },
  retractVote: async (id: string | number) => {
    const result = await request<{ submission_id: number; vote_count: number }>(`/submissions/${id}/vote`, { method: 'DELETE' })
    if (meCacheValue) {
      setMeCache({ ...meCacheValue, voted_submission_id: null })
    } else {
      clearMeCache()
    }
    return result
  },
  mockLogin: async (display_name: string) => {
    const user = await request<User>('/dev/mock-login', { method: 'POST', json: { display_name } })
    setMeCache(user)
    return user
  },
  mockLinkX: async (username: string) => {
    const user = await request<User>('/dev/mock-link-x', { method: 'POST', json: { username } })
    setMeCache(user)
    return user
  },
  mockLinkDiscord: async (username: string) => {
    const user = await request<User>('/dev/mock-link-discord', { method: 'POST', json: { username } })
    setMeCache(user)
    return user
  },
  adminSubmissions: (status?: SubmissionStatus) => request<Submission[]>(`/admin/submissions${status ? `?status=${status}` : ''}`),
  adminSubmission: (id: string | number) => request<Submission>(`/admin/submissions/${id}`),
  approveSubmission: (id: string | number) => request<Submission>(`/admin/submissions/${id}/approve`, { method: 'POST' }),
  rejectSubmission: (id: string | number, reason?: string) => request<Submission>(`/admin/submissions/${id}/reject`, { method: 'POST', json: { reason } }),
}

export function loginUrl(provider: 'x' | 'discord') {
  return `${API_URL}/api/auth/${provider}/login`
}
