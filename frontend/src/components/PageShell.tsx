export function PageShell({ eyebrow, title, intro, children }: { eyebrow?: string; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-5 sm:py-10 lg:px-7">
      <div className="mb-6 max-w-3xl">
        {eyebrow ? <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan">{eyebrow}</p> : null}
        <h1 className="font-heading text-3xl font-black uppercase tracking-[0.04em] text-snow sm:text-4xl lg:text-5xl">{title}</h1>
        {intro ? <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">{intro}</p> : null}
      </div>
      {children}
    </section>
  )
}
