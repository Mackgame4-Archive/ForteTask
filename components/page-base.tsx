import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type PageBaseProps = {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  description?: ReactNode;
  icon?: LucideIcon;
  label: ReactNode;
  title: ReactNode;
};

export function PageBase({
  action,
  children,
  className,
  description,
  icon: Icon,
  label,
  title,
}: PageBaseProps) {
  return (
    <div className="min-h-screen bg-muted/40">
      <div
        className={cn(
          "mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8",
          className
        )}
      >
        <header className="flex flex-col gap-3 border-b border-border pb-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              {Icon ? <Icon className="size-4" /> : null}
              {label}
            </div>
            {action ? <div className="ml-auto">{action}</div> : null}
          </div>
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">{title}</h2>
            {description ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}
