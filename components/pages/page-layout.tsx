import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type PageLayoutProps = {
  title: ReactNode
  backHref?: string
  backLabel?: string
  actions?: ReactNode
  footer?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
}

function PageLayout({
  title,
  backHref,
  backLabel = "Voltar",
  actions,
  footer,
  children,
  className,
  contentClassName,
}: PageLayoutProps) {
  return (
    <div className={cn("flex min-h-screen flex-col bg-muted/40", className)}>
      <header className="border-b border-border bg-background/80 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            {backHref ? (
              <Button
                nativeButton={false}
                variant="ghost"
                size="icon-sm"
                render={<Link href={backHref} />}
                aria-label={backLabel}
              >
                <ArrowLeft />
              </Button>
            ) : null}
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {title}
            </h1>
          </div>
          {actions ? (
            <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
              {actions}
            </div>
          ) : null}
        </div>
      </header>

      <main className={cn("min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8", contentClassName)}>
        {children}
      </main>

      <footer className="border-t border-border bg-background/80 px-4 py-3 text-xs text-muted-foreground sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full items-center justify-between gap-3">
          {footer ?? <span />}
        </div>
      </footer>
    </div>
  )
}

export { PageLayout }
