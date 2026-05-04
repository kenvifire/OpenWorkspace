# UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply a full design system (token-based colors, always-expanded sidebar, per-category accents, readable text hierarchy) across all pages of `apps/app`.

**Architecture:** Design System First — add CSS custom property tokens to `globals.css`, extend badge/button components with category variants, rewrite the sidebar to always-expanded, then apply tokens page-by-page. All changes are styling-only; no logic, routes, or API changes.

**Tech Stack:** Next.js 16, Tailwind CSS v4, shadcn/Base UI components, framer-motion, TypeScript

---

## File Map

| File | Action | What changes |
|---|---|---|
| `apps/app/app/globals.css` | Modify | Add `--text-*`, `--bg-*`, `--border-*`, `--accent-*` tokens to `:root`; update `--radius` base |
| `apps/app/components/ui/badge.tsx` | Rewrite | Local override of shared package; adds `workspace`, `agent`, `skill`, `mcp`, `success`, `error`, `muted` variants |
| `apps/app/components/ui/button.tsx` | Rewrite | Local override; adds `action` variant with cyan styling; adds glow to `default` |
| `apps/app/components/sidebar.tsx` | Rewrite | Remove collapse logic, always 220px, per-category icons, static sections |
| `apps/app/components/kanban/task-card.tsx` | Rewrite | Convert from light mode (`bg-white`) to dark token system |
| `apps/app/components/kanban/task-detail.tsx` | Modify | Convert light mode colors to dark tokens throughout |
| `apps/app/app/[locale]/(app)/dashboard/page.tsx` | Modify | Apply tokens, update workspace card styles |
| `apps/app/app/[locale]/(app)/workspaces/[slug]/projects/[projectId]/board/page.tsx` | Modify | Apply tokens to column headers, add-task input, page header |
| `apps/app/app/[locale]/(app)/marketplace/page.tsx` | Modify | Apply tokens to search bar, filter chips, agent cards |
| `apps/app/app/[locale]/(app)/marketplace/[agentId]/page.tsx` | Modify | Apply tokens to hero, description, hire flow |
| `apps/app/app/[locale]/(app)/workspaces/[slug]/projects/[projectId]/settings/page.tsx` | Modify | Apply tokens to tab nav, agents list, keys list |
| `apps/app/app/[locale]/(app)/workspaces/[slug]/page.tsx` | Modify | Apply tokens to project list, members section |
| `apps/app/app/[locale]/(app)/providers/page.tsx` | Modify | Apply tokens |
| `apps/app/app/[locale]/(app)/billing/page.tsx` | Modify | Apply tokens |
| `apps/app/app/[locale]/(app)/settings/page.tsx` | Modify | Apply tokens |

---

## Task 1: Design Tokens

**Files:**
- Modify: `apps/app/app/globals.css`

- [ ] **Step 1: Add tokens to `:root` in globals.css**

Open `apps/app/app/globals.css` and add the following block inside the existing `:root { ... }` block, after the last existing variable:

```css
  /* ── Text hierarchy ─────────────────── */
  --text-primary: oklch(0.95 0.01 265);
  --text-secondary: oklch(0.65 0.015 265);
  --text-muted: oklch(0.45 0.015 265);

  /* ── Surface hierarchy ──────────────── */
  --bg-base: oklch(0.06 0.012 265);
  --bg-surface: oklch(0.10 0.013 265);
  --bg-elevated: oklch(0.14 0.014 265);
  --bg-overlay: oklch(0.18 0.015 265);

  /* ── Borders ────────────────────────── */
  --border-subtle: oklch(0.16 0.015 265);
  --border-default: oklch(0.22 0.02 265);
  --border-strong: oklch(0.30 0.025 265);

  /* ── Per-category accents ───────────── */
  --accent-workspace: oklch(0.68 0.18 285);
  --accent-workspace-bg: oklch(0.68 0.18 285 / 0.12);
  --accent-workspace-border: oklch(0.68 0.18 285 / 0.30);
  --accent-agent: oklch(0.75 0.15 200);
  --accent-agent-bg: oklch(0.75 0.15 200 / 0.12);
  --accent-agent-border: oklch(0.75 0.15 200 / 0.30);
  --accent-skill: oklch(0.75 0.18 55);
  --accent-skill-bg: oklch(0.75 0.18 55 / 0.12);
  --accent-skill-border: oklch(0.75 0.18 55 / 0.30);
  --accent-mcp: oklch(0.72 0.16 150);
  --accent-mcp-bg: oklch(0.72 0.16 150 / 0.12);
  --accent-mcp-border: oklch(0.72 0.16 150 / 0.30);

  /* ── Status ─────────────────────────── */
  --status-running: oklch(0.72 0.16 150);
  --status-error: oklch(0.58 0.22 25);
```

Also update `--radius` from `0.5rem` to `0.625rem`:

```css
  --radius: 0.625rem;
```

- [ ] **Step 2: Verify TypeScript and CSS compile**

```bash
cd /Users/kenvi/code/openWorkspace/apps/app
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (CSS changes don't affect TS).

- [ ] **Step 3: Commit**

```bash
git add apps/app/app/globals.css
git commit -m "design: add CSS token system for text, surface, border, accent, status"
```

---

## Task 2: Badge Component — Category Variants

**Files:**
- Rewrite: `apps/app/components/ui/badge.tsx`

The current file is `export * from "@openworkspace/ui/badge"`. Replace it with a local version that re-exports the base then adds new variants.

- [ ] **Step 1: Replace badge.tsx with extended local version**

Write the following to `apps/app/components/ui/badge.tsx`:

```tsx
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-[var(--radius-sm)] border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap transition-all focus-visible:ring-[3px] [&>svg]:pointer-events-none [&>svg]:size-3!",
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/kenvi/code/openWorkspace/apps/app && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/app/components/ui/badge.tsx
git commit -m "design: extend Badge with category and status variants"
```

---

## Task 3: Button Component — Action Variant & Primary Glow

**Files:**
- Rewrite: `apps/app/components/ui/button.tsx`

- [ ] **Step 1: Replace button.tsx with extended local version**

Write the following to `apps/app/components/ui/button.tsx`:

```tsx
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
          "bg-[var(--accent-workspace)] text-white shadow-[0_0_16px_var(--accent-workspace)/0.35] hover:shadow-[0_0_22px_var(--accent-workspace)/0.5] hover:bg-[var(--accent-workspace)]/90",
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/kenvi/code/openWorkspace/apps/app && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/app/components/ui/button.tsx
git commit -m "design: extend Button with action variant and workspace accent glow on default"
```

---

## Task 4: Sidebar — Always-Expanded Rewrite

**Files:**
- Rewrite: `apps/app/components/sidebar.tsx`

- [ ] **Step 1: Replace sidebar.tsx**

Write the following complete file to `apps/app/components/sidebar.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  LayoutDashboard, Store, CreditCard, Settings, Plus,
  LogOut, Bot, Zap, Server, Brain,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { workspacesApi, myAgentsApi, skillsApi, mcpsApi } from '@/lib/api';
import { useRef, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth';
import { motion, AnimatePresence } from 'framer-motion';

const WORKSPACE_COLORS = [
  'from-violet-500 to-purple-600',
  'from-sky-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-600',
  'from-pink-500 to-rose-600',
  'from-indigo-500 to-violet-600',
];

export function Sidebar() {
  const pathname = usePathname();
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations('nav');
  const tb = useTranslations('board');
  const { user, signOut } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const { data: workspaces = [] } = useQuery({ queryKey: ['workspaces'], queryFn: workspacesApi.list, enabled: !!user });
  const { data: agents = [] } = useQuery({ queryKey: ['my-agents'], queryFn: myAgentsApi.list, enabled: !!user });
  const { data: skills = [] } = useQuery({ queryKey: ['my-skills'], queryFn: skillsApi.list, enabled: !!user });
  const { data: mcps = [] } = useQuery({ queryKey: ['my-mcps'], queryFn: mcpsApi.list, enabled: !!user });

  const navItems = [
    { label: t('dashboard'), href: `/${locale}/dashboard`, icon: LayoutDashboard },
    { label: t('marketplace'), href: `/${locale}/marketplace`, icon: Store },
    { label: t('billing'), href: `/${locale}/billing`, icon: CreditCard },
  ];

  const handleSignOut = async () => { await signOut(); router.push(`/${locale}/sign-in`); };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <aside className="flex h-screen w-[220px] shrink-0 flex-col overflow-hidden border-e border-[var(--border-subtle)] bg-[var(--bg-surface)]">

      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b border-[var(--border-subtle)] px-4 py-3.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-workspace)] shadow-[0_0_12px_var(--accent-workspace)/0.4]">
          <span className="text-[11px] font-bold text-white" style={{ fontFamily: 'var(--font-syne)' }}>OW</span>
        </div>
        <span className="text-sm font-bold tracking-tight text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-syne)' }}>
          OpenWorkspace
        </span>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2">

        {/* Main nav */}
        <nav className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-[var(--accent-workspace-bg)] text-[var(--accent-workspace)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]',
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r bg-[var(--accent-workspace)]" />
                )}
                <Icon size={15} className="shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Workspaces */}
        <SectionLabel>{t('workspaces')}</SectionLabel>
        <div className="flex flex-col gap-0.5">
          {(workspaces as any[]).map((ws, i) => {
            const active = pathname.includes(`/workspaces/${ws.slug}`);
            return (
              <Link
                key={ws.id}
                href={`/${locale}/workspaces/${ws.slug}`}
                className={cn(
                  'relative flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                  active
                    ? 'bg-[var(--accent-workspace-bg)] text-[var(--accent-workspace)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]',
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-r bg-[var(--accent-workspace)]" />
                )}
                <span className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded bg-gradient-to-br text-[10px] font-bold uppercase text-white',
                  WORKSPACE_COLORS[i % WORKSPACE_COLORS.length],
                )}>
                  {ws.name[0]}
                </span>
                <span className="truncate flex-1">{ws.name}</span>
                {(ws._count?.projects ?? 0) > 0 && (
                  <span className="rounded px-1.5 py-0.5 text-[9px] font-medium bg-[var(--bg-elevated)] text-[var(--text-muted)]">
                    {ws._count.projects}
                  </span>
                )}
              </Link>
            );
          })}
          <AddLink href={`/${locale}/workspaces/new`}>{t('newWorkspace')}</AddLink>
        </div>

        {/* Agents */}
        <SectionLabel>{t('agents')}</SectionLabel>
        <div className="flex flex-col gap-0.5">
          <Link
            href={`/${locale}/agents`}
            className={cn(
              'relative flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
              pathname === `/${locale}/agents`
                ? 'bg-[var(--accent-workspace-bg)] text-[var(--accent-workspace)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]',
            )}
          >
            <CategoryChip color="agent"><Brain size={10} /></CategoryChip>
            <span className="truncate">{tb('plannerAgent')}</span>
          </Link>
          {(agents as any[]).map((agent) => (
            <Link
              key={agent.id}
              href={`/${locale}/agents`}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors"
            >
              <CategoryChip color="agent"><Bot size={10} /></CategoryChip>
              <span className="truncate">{agent.name}</span>
            </Link>
          ))}
          <AddLink href={`/${locale}/agents`}>{t('newAgent')}</AddLink>
        </div>

        {/* Skills */}
        <SectionLabel>{t('skills')}</SectionLabel>
        <div className="flex flex-col gap-0.5">
          {(skills as any[]).map((skill) => (
            <Link
              key={skill.id}
              href={`/${locale}/skills`}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors"
            >
              <CategoryChip color="skill"><Zap size={10} /></CategoryChip>
              <span className="truncate">{skill.name}</span>
            </Link>
          ))}
          <AddLink href={`/${locale}/skills`}>{t('newSkill')}</AddLink>
        </div>

        {/* MCP */}
        <SectionLabel>{t('mcpServers')}</SectionLabel>
        <div className="flex flex-col gap-0.5">
          {(mcps as any[]).map((mcp) => (
            <Link
              key={mcp.id}
              href={`/${locale}/mcp`}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors"
            >
              <CategoryChip color="mcp"><Server size={10} /></CategoryChip>
              <span className="truncate">{mcp.name}</span>
            </Link>
          ))}
          <AddLink href={`/${locale}/mcp`}>{t('newMcp')}</AddLink>
        </div>
      </div>

      {/* User footer */}
      <div className="border-t border-[var(--border-subtle)] px-2 py-2.5">
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-[var(--bg-elevated)] transition-colors"
          >
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-[var(--border-default)]" />
            ) : (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent-workspace-bg)] text-xs font-semibold text-[var(--accent-workspace)]">
                {user?.displayName?.[0] ?? user?.email?.[0] ?? '?'}
              </span>
            )}
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                {user?.displayName || user?.email?.split('@')[0] || 'Account'}
              </p>
              <p className="truncate text-xs text-[var(--text-muted)]">{user?.email}</p>
            </div>
            <Settings size={13} className="shrink-0 text-[var(--text-muted)]" />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97 }}
                transition={{ duration: 0.12 }}
                className="absolute bottom-full left-0 right-0 mb-1 overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-xl shadow-black/40"
              >
                <Link
                  href={`/${locale}/settings`}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <Settings size={13} className="text-[var(--text-muted)]" />{t('settings')}
                </Link>
                <div className="mx-3 border-t border-[var(--border-subtle)]" />
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)] hover:text-[var(--status-error)] transition-colors"
                >
                  <LogOut size={13} className="text-[var(--text-muted)]" />{t('signOut')}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
      {children}
    </p>
  );
}

function CategoryChip({ color, children }: { color: 'agent' | 'skill' | 'mcp'; children: React.ReactNode }) {
  return (
    <span className={cn(
      'flex h-5 w-5 shrink-0 items-center justify-center rounded',
      color === 'agent' && 'bg-[var(--accent-agent-bg)] text-[var(--accent-agent)]',
      color === 'skill' && 'bg-[var(--accent-skill-bg)] text-[var(--accent-skill)]',
      color === 'mcp'   && 'bg-[var(--accent-mcp-bg)] text-[var(--accent-mcp)]',
    )}>
      {children}
    </span>
  );
}

function AddLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-secondary)] transition-colors"
    >
      <Plus size={12} />
      {children}
    </Link>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/kenvi/code/openWorkspace/apps/app && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Start dev server and verify sidebar visually**

```bash
cd /Users/kenvi/code/openWorkspace && pnpm dev
```

Open http://localhost:3000 and confirm: always-expanded 220px sidebar, per-category icon chips, no collapse toggle, section labels visible.

- [ ] **Step 4: Commit**

```bash
git add apps/app/components/sidebar.tsx
git commit -m "design: rewrite sidebar to always-expanded 220px with category icon chips"
```

---

## Task 5: Dashboard Page

**Files:**
- Modify: `apps/app/app/[locale]/(app)/dashboard/page.tsx`

- [ ] **Step 1: Replace inline colors with tokens**

The dashboard has two areas to update: the header section and workspace cards. Apply these specific changes:

Replace the greeting `p` tag color:
```tsx
// Before
<p className="text-sm font-medium text-[oklch(0.55_0.02_265)] mb-1">

// After
<p className="text-sm font-medium text-[var(--text-muted)] mb-1">
```

Replace the subtitle `p` tag:
```tsx
// Before
<p className="mt-2 text-sm text-[oklch(0.55_0.02_265)]">

// After
<p className="mt-2 text-sm text-[var(--text-secondary)]">
```

Replace the empty state border and bg:
```tsx
// Before
className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[oklch(0.22_0.02_265)] bg-[oklch(0.12_0.014_265)] py-28 text-center"

// After
className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] py-28 text-center"
```

Replace the empty state subtitle:
```tsx
// Before
<p className="mt-2 text-sm text-[oklch(0.55_0.02_265)] max-w-xs">

// After
<p className="mt-2 text-sm text-[var(--text-secondary)] max-w-xs">
```

Replace each workspace card wrapper `div`:
```tsx
// Before
<div className="group relative overflow-hidden rounded-2xl border border-[oklch(0.22_0.02_265)] bg-[oklch(0.12_0.014_265)] p-5 shadow-lg shadow-black/30 transition-all hover:border-[oklch(0.32_0.04_265)] hover:shadow-[0_8px_32px_black/50]">

// After
<div className="group relative overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-lg shadow-black/30 transition-all hover:border-[var(--border-strong)] hover:shadow-[0_8px_32px_black/50]">
```

Replace the workspace card stat row border:
```tsx
// Before
<div className="mt-4 flex gap-4 text-xs text-[oklch(0.55_0.02_265)] border-t border-[oklch(0.22_0.02_265)] pt-3">

// After
<div className="mt-4 flex gap-4 text-xs text-[var(--text-muted)] border-t border-[var(--border-subtle)] pt-3">
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/kenvi/code/openWorkspace/apps/app && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add "apps/app/app/[locale]/(app)/dashboard/page.tsx"
git commit -m "design: apply token system to dashboard page"
```

---

## Task 6: Kanban Task Card

**Files:**
- Rewrite: `apps/app/components/kanban/task-card.tsx`

The task card currently uses light-mode colors (`bg-white`, `text-zinc-900`). Fully rewrite it to the dark token system.

- [ ] **Step 1: Rewrite task-card.tsx**

```tsx
'use client';

import { Draggable } from '@hello-pangea/dnd';
import { CalendarDays, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Task } from '@openworkspace/api-types';

const priorityStyles: Record<string, string> = {
  URGENT: 'bg-[var(--status-error)]/10 border-[var(--status-error)]/30 text-[var(--status-error)]',
  HIGH:   'bg-[var(--accent-skill-bg)] border-[var(--accent-skill-border)] text-[var(--accent-skill)]',
  MEDIUM: 'bg-[var(--accent-workspace-bg)] border-[var(--accent-workspace-border)] text-[var(--accent-workspace)]',
  LOW:    'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)]',
};

interface TaskCardProps {
  task: Task;
  index: number;
  onClick: (task: Task) => void;
}

export function TaskCard({ task, index, onClick }: TaskCardProps) {
  const isRunning = (task as any).latestRunStatus === 'RUNNING';

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onClick(task)}
          className={cn(
            'rounded-lg border bg-[var(--bg-surface)] p-3 cursor-pointer select-none transition-all',
            isRunning
              ? 'border-[var(--accent-agent-border)] shadow-[0_0_12px_var(--accent-agent)/0.15]'
              : 'border-[var(--border-default)] hover:border-[var(--border-strong)]',
            snapshot.isDragging && 'rotate-1 shadow-xl shadow-black/40',
          )}
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <p className="text-sm font-medium leading-snug text-[var(--text-primary)] line-clamp-2">
              {task.title}
            </p>
            {task.priority && (
              <span className={cn(
                'shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold',
                priorityStyles[task.priority] ?? priorityStyles.LOW,
              )}>
                {task.priority}
              </span>
            )}
          </div>

          {task.assignee && (
            <div className="mb-2">
              <span className={cn(
                'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px]',
                'bg-[var(--accent-agent-bg)] border-[var(--accent-agent-border)] text-[var(--accent-agent)]',
              )}>
                {task.assignee.agent?.type === 'AI' ? '🤖' : '👤'}
                {task.assignee.agent?.name}
                {isRunning && (
                  <span className="ml-1 h-1.5 w-1.5 rounded-full bg-[var(--status-running)] shadow-[0_0_4px_var(--status-running)]" />
                )}
              </span>
            </div>
          )}

          <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
            {task.dueDate && (
              <span className="flex items-center gap-1">
                <CalendarDays size={11} />
                {new Date(task.dueDate).toLocaleDateString()}
              </span>
            )}
            {(task._count?.comments ?? 0) > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare size={11} />
                {task._count!.comments}
              </span>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/kenvi/code/openWorkspace/apps/app && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add apps/app/components/kanban/task-card.tsx
git commit -m "design: rewrite TaskCard to dark token system with agent glow on running tasks"
```

---

## Task 7: Task Detail Panel

**Files:**
- Modify: `apps/app/components/kanban/task-detail.tsx`

The task detail uses extensive light-mode classes. Apply a targeted find-and-replace pass for the main color tokens.

- [ ] **Step 1: Replace light-mode color classes throughout task-detail.tsx**

Apply these replacements (use your editor's find-and-replace or sed):

```bash
cd /Users/kenvi/code/openWorkspace/apps/app
```

Run each substitution:

| Find | Replace |
|---|---|
| `bg-white` | `bg-[var(--bg-surface)]` |
| `border-zinc-100` | `border-[var(--border-subtle)]` |
| `border-zinc-200` | `border-[var(--border-default)]` |
| `text-zinc-900` | `text-[var(--text-primary)]` |
| `text-zinc-700` | `text-[var(--text-primary)]` |
| `text-zinc-600` | `text-[var(--text-secondary)]` |
| `text-zinc-500` | `text-[var(--text-secondary)]` |
| `text-zinc-400` | `text-[var(--text-muted)]` |
| `text-zinc-300` | `text-[var(--text-muted)]` |
| `bg-zinc-50` | `bg-[var(--bg-elevated)]` |
| `bg-zinc-100` | `bg-[var(--bg-elevated)]` |
| `bg-blue-100 text-blue-700` | `bg-[var(--accent-agent-bg)] text-[var(--accent-agent)]` |
| `bg-green-100 text-green-700` | `bg-[var(--accent-mcp-bg)] text-[var(--status-running)]` |
| `bg-red-100 text-red-600` | `bg-[var(--status-error)]/10 text-[var(--status-error)]` |
| `bg-yellow-100 text-yellow-700` | `bg-[var(--accent-skill-bg)] text-[var(--accent-skill)]` |
| `text-violet-600 bg-violet-50` | `text-[var(--accent-workspace)] bg-[var(--accent-workspace-bg)]` |

Also replace the `RUN_STATUS_COLOR` map at the top of the file:

```tsx
const RUN_STATUS_COLOR: Record<string, string> = {
  RUNNING:        'bg-[var(--accent-agent-bg)] text-[var(--accent-agent)]',
  COMPLETED:      'bg-[var(--accent-mcp-bg)] text-[var(--status-running)]',
  STOPPED:        'bg-[var(--bg-elevated)] text-[var(--text-muted)]',
  FAILED:         'bg-[var(--status-error)]/10 text-[var(--status-error)]',
  MAX_ITERATIONS: 'bg-[var(--accent-skill-bg)] text-[var(--accent-skill)]',
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/kenvi/code/openWorkspace/apps/app && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Open Kanban board in browser and verify task card + task detail panel look correct**

Navigate to any project board page. Click a task card. Confirm the detail panel is dark-themed.

- [ ] **Step 4: Commit**

```bash
git add apps/app/components/kanban/task-detail.tsx
git commit -m "design: convert task detail panel from light mode to dark token system"
```

---

## Task 8: Kanban Board Page

**Files:**
- Modify: `apps/app/app/[locale]/(app)/workspaces/[slug]/projects/[projectId]/board/page.tsx`

- [ ] **Step 1: Update COLUMNS config and column header styles**

Replace the `COLUMNS` array:

```tsx
const COLUMNS: { id: TaskStatus; label: string; accentClass: string }[] = [
  { id: 'BACKLOG',     label: 'Backlog',      accentClass: 'text-[var(--text-muted)]' },
  { id: 'TODO',        label: 'To Do',        accentClass: 'text-[var(--accent-workspace)]' },
  { id: 'IN_PROGRESS', label: 'In Progress',  accentClass: 'text-[var(--accent-agent)]' },
  { id: 'BLOCKED',     label: 'Blocked',      accentClass: 'text-[var(--status-error)]' },
  { id: 'DONE',        label: 'Done',         accentClass: 'text-[var(--status-running)]' },
];
```

Find each place where `topColor` or `dotColor` are used in the JSX (the column header div) and replace with:

```tsx
<div className="flex items-center gap-2 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
  <span className={cn('h-1.5 w-1.5 rounded-full', col.accentClass.replace('text-', 'bg-'))} />
  {col.label}
  <span className="ml-auto rounded px-1.5 py-0.5 text-[9px] font-medium bg-[var(--bg-elevated)] text-[var(--text-muted)]">
    {tasks.filter(t => t.status === col.id).length}
  </span>
</div>
```

Replace the add-task input area colors:

```tsx
// Before: any bg-white, border-zinc-*, text-zinc-* in the inline task input
// After:
<Input
  className="bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
  ...
/>
```

Replace column wrapper background:

```tsx
// Before: bg-zinc-50 or similar column background
// After: bg-[var(--bg-base)] or transparent
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/kenvi/code/openWorkspace/apps/app && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add "apps/app/app/[locale]/(app)/workspaces/[slug]/projects/[projectId]/board/page.tsx"
git commit -m "design: apply token system to Kanban board columns and page header"
```

---

## Task 9: Marketplace Pages

**Files:**
- Modify: `apps/app/app/[locale]/(app)/marketplace/page.tsx`
- Modify: `apps/app/app/[locale]/(app)/marketplace/[agentId]/page.tsx`

- [ ] **Step 1: Update marketplace/page.tsx**

Apply this pattern throughout the file — any `text-zinc-*`, `bg-zinc-*`, `border-zinc-*` classes:

| Find | Replace |
|---|---|
| `text-zinc-900`, `text-zinc-800` | `text-[var(--text-primary)]` |
| `text-zinc-600`, `text-zinc-500` | `text-[var(--text-secondary)]` |
| `text-zinc-400`, `text-zinc-300` | `text-[var(--text-muted)]` |
| `bg-white` | `bg-[var(--bg-surface)]` |
| `bg-zinc-50`, `bg-zinc-100` | `bg-[var(--bg-elevated)]` |
| `border-zinc-200` | `border-[var(--border-default)]` |
| `border-zinc-100` | `border-[var(--border-subtle)]` |

For the search input, ensure it uses:
```tsx
className="bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] rounded-lg"
```

For active filter chips (those using violet/primary active state), ensure they use:
```tsx
// active chip
className="bg-[var(--accent-workspace-bg)] border-[var(--accent-workspace-border)] text-[var(--accent-workspace)] rounded-lg px-3 py-1.5 text-sm"
// inactive chip
className="bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] rounded-lg px-3 py-1.5 text-sm"
```

- [ ] **Step 2: Update marketplace/[agentId]/page.tsx** with same color token replacements.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/kenvi/code/openWorkspace/apps/app && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add "apps/app/app/[locale]/(app)/marketplace/page.tsx" "apps/app/app/[locale]/(app)/marketplace/[agentId]/page.tsx"
git commit -m "design: apply token system to marketplace pages"
```

---

## Task 10: Project Settings Page

**Files:**
- Modify: `apps/app/app/[locale]/(app)/workspaces/[slug]/projects/[projectId]/settings/page.tsx`

- [ ] **Step 1: Update tab navigation to use accent underline**

Find the tab button/link elements and apply:

```tsx
// Active tab
className="border-b-2 border-[var(--accent-workspace)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-workspace)]"

// Inactive tab
className="border-b-2 border-transparent px-4 py-2.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
```

- [ ] **Step 2: Update agent list rows**

Each hired agent row should use:

```tsx
<div className="flex items-center gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3">
  {/* avatar */}
  {/* name + role */}
  <Badge variant="agent">DEVELOPER</Badge>
  <span className="text-xs text-[var(--text-muted)]">Hired 2 days ago</span>
  {/* status badge using variant="success" or "muted" */}
  <Badge variant="success">Active</Badge>
</div>
```

- [ ] **Step 3: Apply standard token replacements for all remaining zinc/white classes** (same find-replace table as Task 9).

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/kenvi/code/openWorkspace/apps/app && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add "apps/app/app/[locale]/(app)/workspaces/[slug]/projects/[projectId]/settings/page.tsx"
git commit -m "design: apply token system to project settings page"
```

---

## Task 11: Remaining Pages

**Files:**
- Modify: `apps/app/app/[locale]/(app)/workspaces/[slug]/page.tsx`
- Modify: `apps/app/app/[locale]/(app)/workspaces/[slug]/settings/page.tsx`
- Modify: `apps/app/app/[locale]/(app)/workspaces/new/page.tsx`
- Modify: `apps/app/app/[locale]/(app)/workspaces/[slug]/projects/new/page.tsx`
- Modify: `apps/app/app/[locale]/(app)/providers/page.tsx`
- Modify: `apps/app/app/[locale]/(app)/billing/page.tsx`
- Modify: `apps/app/app/[locale]/(app)/settings/page.tsx`

- [ ] **Step 1: Apply standard token replacements to all seven files**

For each file, apply the same find-replace table from Task 9. Additionally:

For `workspaces/[slug]/page.tsx` (project list + members), update project cards to match the workspace card pattern from Task 5:

```tsx
<div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 hover:border-[var(--border-strong)] transition-colors">
```

For `providers/page.tsx`, any agent/provider card rows use:
```tsx
<div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/kenvi/code/openWorkspace/apps/app && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Final visual check — run dev server and walk through all pages**

```bash
cd /Users/kenvi/code/openWorkspace && pnpm dev
```

Visit in order: Dashboard → Workspace → Board → Marketplace → Project Settings → Billing → Providers → Settings. Confirm consistent dark token colors and no white/zinc remnants.

- [ ] **Step 4: Commit**

```bash
git add \
  "apps/app/app/[locale]/(app)/workspaces/[slug]/page.tsx" \
  "apps/app/app/[locale]/(app)/workspaces/[slug]/settings/page.tsx" \
  "apps/app/app/[locale]/(app)/workspaces/new/page.tsx" \
  "apps/app/app/[locale]/(app)/workspaces/[slug]/projects/new/page.tsx" \
  "apps/app/app/[locale]/(app)/providers/page.tsx" \
  "apps/app/app/[locale]/(app)/billing/page.tsx" \
  "apps/app/app/[locale]/(app)/settings/page.tsx"
git commit -m "design: apply token system to remaining pages (workspace, new forms, providers, billing, settings)"
```
