import { ArrowRight, FlaskConical } from 'lucide-react'

export function LetsTalkWidget() {
  return (
    <aside className="mt-6 rounded-lg border bg-fd-card p-4 text-sm">
      <p className="flex items-center gap-2 font-semibold text-fd-foreground">
        <FlaskConical className="size-4" />
        Start without native
      </p>
      <p className="mt-1 text-fd-muted-foreground">
        The mock adapter runs the whole capture flow before you wire up iOS or
        Android.
      </p>
      <a
        href="/docs/mock"
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-fd-primary px-3 py-2 font-medium text-fd-primary-foreground transition-colors hover:bg-fd-primary/80"
      >
        Mock adapter
        <ArrowRight className="size-4" />
      </a>
    </aside>
  )
}
