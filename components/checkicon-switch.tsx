"use client"

import { CheckCircle2, Circle } from "lucide-react"

import { cn } from "@/lib/utils"

type CheckIconSwitchProps = {
  checked: boolean
  disabled?: boolean
  label: string
  onCheckedChange?: (checked: boolean) => void
  className?: string
}

function CheckIconSwitch({
  checked,
  disabled,
  label,
  onCheckedChange,
  className,
}: CheckIconSwitchProps) {
  const Icon = checked ? CheckCircle2 : Circle

  return (
    <button
      type="button"
      aria-label={label}
      aria-checked={checked}
      disabled={disabled}
      role="switch"
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-none text-muted-foreground transition-colors outline-none hover:text-primary focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-checked:text-primary [&_svg]:size-4",
        className
      )}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onCheckedChange?.(!checked)
      }}
    >
      <Icon />
    </button>
  )
}

export { CheckIconSwitch }
