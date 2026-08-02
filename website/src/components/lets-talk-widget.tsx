import { ArrowRight, ListChecks } from 'lucide-react'

export function LetsTalkWidget() {
  return (
    <aside className="mt-6 rounded-lg border bg-fd-card p-4 text-sm">
      <p className="flex items-center gap-2 font-semibold text-fd-foreground">
        <ListChecks className="size-4" />
        V1 focus
      </p>
      <p className="mt-1 text-fd-muted-foreground">
        Prove the Lynx bridge first, then add camera behavior behind the same
        API.
      </p>
      <a
        href="/docs/bridge-spike"
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-fd-primary px-3 py-2 font-medium text-fd-primary-foreground transition-colors hover:bg-fd-primary/80"
      >
        Bridge spike
        <ArrowRight className="size-4" />
      </a>
    </aside>
  )
}
