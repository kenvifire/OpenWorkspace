"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--accent-workspace)] text-white shadow-[0_0_16px_var(--accent-workspace-glow)] hover:shadow-[0_0_22px_var(--accent-workspace-glow-hover)] hover:bg-[var(--accent-workspace)]/90",
        outline:
          "border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]",
        secondary:
          "bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)] hover:text-[var(--text-primary)]",
        ghost:
          "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]",
        destructive:
          "bg-[var(--status-error)]/10 border-[var(--status-error)]/30 text-[var(--status-error)] hover:bg-[var(--status-error)]/20",
        action:
          "bg-[var(--accent-agent-bg)] border-[var(--accent-agent-border)] text-[var(--accent-agent)] hover:bg-[var(--accent-agent)]/20",
        link: "text-[var(--accent-workspace)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 gap-1.5 px-2.5",
        xs: "h-6 gap-1 rounded-[var(--radius-sm)] px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[var(--radius-sm)] px-2.5 text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-3",
        icon: "size-8",
        "icon-xs": "size-6 rounded-[var(--radius-sm)] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 rounded-[var(--radius-sm)]",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
