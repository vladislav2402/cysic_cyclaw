import type { SubmissionStatus } from '@/lib/types'

const styles: Record<SubmissionStatus, string> = {
  pending: 'border-amber-300/30 bg-amber-300/10 text-amber-100',
  approved: 'border-lime/30 bg-lime/10 text-lime',
  rejected: 'border-rose-300/30 bg-rose-400/10 text-rose-100',
}

export function StatusPill({ status }: { status: SubmissionStatus }) {
  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${styles[status]}`}>{status}</span>
}
