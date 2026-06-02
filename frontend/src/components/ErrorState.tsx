export function ErrorState({ message }: { message: string }) {
  return <div className="rounded-lg border border-rose-300/20 bg-rose-500/10 p-5 text-rose-100">{message}</div>
}
