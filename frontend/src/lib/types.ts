export type SubmissionStatus = 'pending' | 'approved' | 'rejected'

export type Account = {
  username: string
}

export type User = {
  id: number
  display_name: string | null
  x_account: Account | null
  discord_account: Account | null
  is_verified: boolean
  is_admin: boolean
  voted_submission_id: number | null
  submitted_submission_id: number | null
}

export type Submission = {
  id: number
  participant_name: string
  project_title: string | null
  tweet_url: string
  tweet_id: string
  tweet_username: string | null
  discord_handle: string | null
  description: string | null
  status: SubmissionStatus
  rejection_reason: string | null
  vote_count: number
  created_at: string
}
