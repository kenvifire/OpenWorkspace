import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-[var(--radius-sm)] border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary border-transparent text-primary-foreground",
        secondary: "bg-secondary border-transparent text-secondary-foreground",
        destructive: "bg-[var(--status-error)]/10 border-[var(--status-error)]/30 text-[var(--status-error)]",
        outline: "border-[var(--border-default)] text-[var(--text-secondary)]",
        ghost: "border-transparent hover:bg-muted",
        // ── Category variants ──────────────────────────────────────────
        workspace: "bg-[var(--accent-workspace-bg)] border-[var(--accent-workspace-border)] text-[var(--accent-workspace)]",
        agent:     "bg-[var(--accent-agent-bg)] border-[var(--accent-agent-border)] text-[var(--accent-agent)]",
        skill:     "bg-[var(--accent-skill-bg)] border-[var(--accent-skill-border)] text-[var(--accent-skill)]",
        mcp:       "bg-[var(--accent-mcp-bg)] border-[var(--accent-mcp-border)] text-[var(--accent-mcp)]",
        // ── Status variants ────────────────────────────────────────────
        success: "bg-[var(--accent-mcp-bg)] border-[var(--accent-mcp-border)] text-[var(--status-running)]",
        error:   "bg-[var(--status-error)]/10 border-[var(--status-error)]/30 text-[var(--status-error)]",
        muted:   "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)]",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">({ className: cn(badgeVariants({ variant }), className) }, props),
    render,
    state: { slot: "badge", variant },
  })
}

export { Badge, badgeVariants }
