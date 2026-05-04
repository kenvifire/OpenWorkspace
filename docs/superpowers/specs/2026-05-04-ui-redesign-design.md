# UI Redesign — Design Spec
**Date:** 2026-05-04  
**Scope:** Full polish pass across all pages of `apps/app`  
**Approach:** Design System First — establish tokens, then apply to components and pages

---

## 1. Goals

- Replace scattered inline `oklch()` values with a coherent CSS custom property token system
- Fix text contrast/readability: collapse 8+ ad-hoc gray shades into 3 clear hierarchy levels
- Apply a Bold & Structured visual direction: full-label sidebar, per-category accent colors, information-dense layouts
- Remove the collapsible sidebar toggle — always-expanded 220px fixed sidebar
- Establish per-category accent colors (violet/cyan/amber/emerald) used consistently across icons, badges, and status indicators

## 2. Design Direction

**Bold & Structured** — full sidebar labels, colorful workspace avatars, distinct accent-per-category system. Information-dense layouts similar to Notion dark / Linear. Dark-only (no light mode). Fonts unchanged (Syne headings, DM Sans body).

---

## 3. Design Token System

### 3.1 Text Hierarchy (3 levels)

| Token | Value | Usage |
|---|---|---|
| `--text-primary` | `oklch(0.95 0.01 265)` | Headings, active labels, primary content |
| `--text-secondary` | `oklch(0.65 0.015 265)` | Body text, descriptions, inactive nav |
| `--text-muted` | `oklch(0.45 0.015 265)` | Section labels, metadata, timestamps |

All existing ad-hoc values (e.g. `oklch(0.55 0.02 265)`, `oklch(0.44...)`, `oklch(0.33...)`) are replaced with one of these three tokens.

### 3.2 Surface Hierarchy (4 levels)

| Token | Value | Usage |
|---|---|---|
| `--bg-base` | `oklch(0.06 0.012 265)` | Main canvas background |
| `--bg-surface` | `oklch(0.10 0.013 265)` | Cards, sidebar |
| `--bg-elevated` | `oklch(0.14 0.014 265)` | Modals, dropdowns |
| `--bg-overlay` | `oklch(0.18 0.015 265)` | Tooltips, popovers |

### 3.3 Border Tokens

| Token | Value | Usage |
|---|---|---|
| `--border-subtle` | `oklch(0.16 0.015 265)` | Dividers within cards |
| `--border-default` | `oklch(0.22 0.02 265)` | Card borders, inputs |
| `--border-strong` | `oklch(0.30 0.025 265)` | Hover states, focus rings |

### 3.4 Per-Category Accent Colors

| Category | Token | Color | Usage |
|---|---|---|---|
| Workspaces / Primary | `--accent-workspace` | `oklch(0.68 0.18 285)` violet | Brand color, primary actions, active nav indicator |
| Agents | `--accent-agent` | `oklch(0.75 0.15 200)` cyan | Agent icons, run logs, agent badges |
| Skills | `--accent-skill` | `oklch(0.75 0.18 55)` amber | Skill icons, skill badges, zap indicators |
| MCP Servers | `--accent-mcp` | `oklch(0.72 0.16 150)` emerald | MCP icons, server status, connection indicators |

### 3.5 Status Colors

| Status | Color |
|---|---|
| Running / Online | `oklch(0.72 0.16 150)` emerald green |
| Failed / Error | `oklch(0.58 0.22 25)` red |
| Idle / Inactive | `--text-muted` |

### 3.6 Radius Tokens

Update `--radius` base value in `globals.css` from `0.5rem` to `0.625rem` (10px). The existing calc multipliers (`--radius-sm: calc(var(--radius) * 0.6)` etc.) auto-adjust to:

| Token | Resulting value | Usage |
|---|---|---|
| `--radius-sm` | `~6px` | Buttons, badges, tags |
| `--radius-md` | `~8px` | Cards, inputs, sidebar items |
| `--radius-lg` | `~10px` | Standard panels |
| `--radius-xl` | `~14px` | Modals, sheets, large panels |

---

## 4. Sidebar Redesign

**File:** `apps/app/components/sidebar.tsx`

### Changes
- **Remove** collapse toggle and all collapsed-state logic (`collapsed` state, `localStorage`, `w-16` variant, `Label` animation component)
- **Fixed width:** always `w-[220px]`
- **Brand header:** OW logo + "OpenWorkspace" in a bordered header section (no plan label — not in data model)
- **Nav items:** left accent bar (3px, `--accent-workspace`) on active item; `--text-secondary` on inactive; `--text-primary` on active
- **Section headers:** `text-[10px] font-semibold uppercase tracking-widest --text-muted` — remove chevron toggles, sections always visible
- **Workspace items:** colored gradient avatar (existing), project count badge (small pill, `--bg-elevated`), no collapse animation
- **Agent items:** cyan icon chip (`--accent-agent` bg at 15% opacity), online status dot (emerald glow) when agent is running
- **Skill items:** amber icon chip (`--accent-skill` bg at 15% opacity)
- **MCP items:** emerald icon chip (`--accent-mcp` bg at 15% opacity), connection status dot
- **User footer:** avatar, name + email (truncated), settings icon — no popup menu on hover (use dropdown on click, keep existing logic but restyled)
- **Remove** all `AnimatePresence` / `motion` wrappers (collapsed state, section toggles) — sidebar is fully static, all sections always visible

---

## 5. Shared Components

**Directory:** `apps/app/components/ui/`

### button.tsx
- `primary`: violet bg, `box-shadow: 0 0 16px var(--accent-workspace / 0.35)`, white text
- `secondary`: `--bg-surface` bg, `--border-default` border, `--text-secondary` text
- `destructive`: `oklch(0.58 0.22 25 / 0.15)` bg, red border at 30%, red text
- `ghost`: no border, hover shows `--bg-elevated` bg
- New `action` variant: agent-colored (`--accent-agent / 0.15` bg, cyan border + text) for "Run Agent" buttons

### badge.tsx
New variants matching the accent system:
- `workspace` (violet), `agent` (cyan), `skill` (amber), `mcp` (emerald)
- `success` (emerald), `error` (red), `muted` (gray)
- All: `border-radius: var(--radius-sm)`, `font-size: 11px`, `font-weight: 500`

### card.tsx
- Border: `--border-default`
- Background: `--bg-surface`
- Border-radius: `var(--radius-md)`
- Hover: border transitions to `--border-strong`

### input.tsx / select.tsx / textarea.tsx
- Border: `--border-default`, focus `--border-strong`
- Background: `--bg-surface`
- Placeholder: `--text-muted`
- Text: `--text-primary`

---

## 6. Page-by-Page Changes

### 6.1 Dashboard (`dashboard/page.tsx`)
- Header: greeting line (`--text-muted`), name in `text-3xl font-bold --text-primary Syne`, subtitle `--text-secondary`
- Workspace grid: 3-col, cards use updated `card.tsx`, gradient avatar with subtle background radial glow, arrow icon on hover, stat row with category-colored icons
- Empty state: unchanged structure, apply token classes

### 6.2 Kanban Board (`workspaces/[slug]/projects/[id]/board/`)
- Page header: project name + sprint, agent running count pill (cyan badge), "Add Task" secondary button
- Columns: column header `--text-muted uppercase tracking-widest`, task count in `--bg-elevated` pill
- Task cards: `--bg-surface` background, `--border-default` border; active-agent cards get `--accent-agent` border + faint glow; category badge chips; agent avatar + status in footer
- Task detail panel: tabs (Details / Logs) with `--accent-workspace` active underline; Logs tab uses monospace `--font-mono` in `--bg-base`

### 6.3 Marketplace (`marketplace/page.tsx` + `[agentId]/page.tsx`)
- Search bar: full-width, `--bg-surface` + `--border-default`
- Filter chips: inactive = `--bg-surface` outlined; active = `--accent-workspace / 0.15` bg + violet border + violet text with `×`
- Agent cards: emoji/logo avatar in gradient rounded square, name `--text-primary`, provider `--text-muted`, description `--text-secondary`, star rating in emerald badge, price `--text-muted`, "Hire" primary button
- Agent detail: hero section with larger avatar, description, reviews, hire flow unchanged

### 6.4 Project Settings (`workspaces/[slug]/projects/[id]/settings/`)
- Tabs: `--accent-workspace` underline on active tab, `--text-muted` on inactive
- Agents list: each row is a `--bg-surface` card with agent avatar, name, role badge, hired date, status badge, "Manage" secondary button
- Resource keys: monospace key display, copy button, revoke destructive button
- Planner section: unchanged structure, apply tokens

### 6.5 Workspace Page (`workspaces/[slug]/`)
- Project list: cards with project name, description, task count, member avatars
- Members section: avatar + name + role badge per row
- Invite: input + primary button

### 6.6 Secondary Pages (Providers, Billing, Settings)
- Apply token system: replace all inline colors, apply card/button/badge components
- No layout restructuring

---

## 7. Out of Scope

- Light mode
- New features or routes
- Animation system changes (keep existing framer-motion)
- `apps/website` (marketing site)
- `apps/api` (backend)
- Mobile / responsive breakpoints (desktop-first SaaS)

---

## 8. Implementation Order

1. `globals.css` — add token variables
2. `components/sidebar.tsx` — always-expanded redesign
3. `components/ui/button.tsx`, `badge.tsx`, `card.tsx`, `input.tsx`, `select.tsx`, `textarea.tsx`
4. `dashboard/page.tsx`
5. Kanban board + task card + task detail
6. Marketplace pages
7. Project settings page
8. Workspace page + secondary pages (providers, billing, settings)
