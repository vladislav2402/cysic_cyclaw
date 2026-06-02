export function LoadingState({ label = 'Loading signal...' }: { label?: string }) {
  return (
    <div className="cy-card p-8 text-center text-slate-300">
      <div className="mx-auto mb-4 h-10 w-10 animate-pulse rounded-lg border border-cyan/40 bg-cyan/10 shadow-glow" />
      {label}
    </div>
  )
}
