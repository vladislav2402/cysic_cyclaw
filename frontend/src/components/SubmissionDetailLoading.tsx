import { PageShell } from '@/components/PageShell'

export function SubmissionDetailLoading() {
  return (
    <PageShell title="Loading project">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-h-[28rem] animate-pulse rounded-lg border border-white/10 bg-white/[0.04]" />
        <aside className="cy-card h-fit p-5">
          <div className="h-28 animate-pulse rounded-lg border border-white/10 bg-white/[0.04]" />
          <div className="mt-5 grid gap-4">
            <div className="h-14 animate-pulse rounded-lg bg-white/[0.04]" />
            <div className="h-14 animate-pulse rounded-lg bg-white/[0.04]" />
            <div className="h-12 animate-pulse rounded-lg bg-white/[0.04]" />
          </div>
          <div className="mt-5 h-11 animate-pulse rounded-lg bg-cyan/15" />
        </aside>
      </div>
    </PageShell>
  )
}
