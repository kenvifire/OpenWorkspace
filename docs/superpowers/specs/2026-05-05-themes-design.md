# Theme System Design

## Overview

Add 4 visual themes to the app: **Dark Purple** (current default), **Light**, **Dark Ocean**, and **Midnight**. The user picks a theme from their avatar menu in the sidebar; the selection is stored in the database and persists across devices. A cookie-based flash-prevention script ensures the correct theme renders on first paint with no flicker.

---

## Architecture

The system has three layers:

1. **CSS layer** — `globals.css` defines four `[data-theme="..."]` selector blocks, each overriding the full design token set (`--bg-base`, `--text-primary`, `--accent-workspace`, etc.). The existing `:root` block stays as-is and serves as the Dark Purple default — no behaviour change for existing users.

2. **React layer** — A `ThemeProvider` client component wraps the app inside `providers.tsx`. It receives an `initialTheme` prop from the server layout (read from a cookie), sets `document.documentElement.dataset.theme` on mount and on every change, and exposes `{ theme, setTheme }` via context. `setTheme` updates the DOM immediately (optimistic) then fire-and-forgets a `PATCH /api/users/me`.

3. **Flash prevention** — An inline `<script>` in `layout.tsx` (executes synchronously before React hydration) reads the `theme` cookie and sets `data-theme` on `<html>`. The API sets this cookie on login and on every theme change. First paint is always correct — no flash even on hard refresh or when switching devices.

### Data flow for a theme switch

```
User clicks swatch → setTheme("dark-ocean")
  → document.documentElement.dataset.theme = "dark-ocean"   (instant)
  → PATCH /api/users/me { theme: "dark-ocean" }              (async)
  → Response sets Set-Cookie: theme=dark-ocean               (for flash prevention)
```

---

## Themes

| ID | Name | Character |
|----|------|-----------|
| `dark-purple` | Dark Purple | Current default. Deep purple-grey surfaces, violet accents. |
| `light` | Light | White/near-white surfaces, same purple accent family. |
| `dark-ocean` | Dark Ocean | Dark blue-grey surfaces, teal/cyan accent shift. |
| `midnight` | Midnight | Near-neutral dark grey, minimal chroma, subdued accents. |

### CSS token blocks

All four themes override the same token names. The `:root` block (Dark Purple) stays unchanged:

```css
[data-theme="light"] {
  --text-primary:   oklch(0.15 0.01 265);
  --text-secondary: oklch(0.40 0.015 265);
  --text-muted:     oklch(0.60 0.015 265);
  --bg-base:        oklch(0.97 0.005 265);
  --bg-surface:     oklch(1.00 0.000 265);
  --bg-elevated:    oklch(0.95 0.006 265);
  --bg-overlay:     oklch(0.92 0.007 265);
  --border-subtle:  oklch(0.88 0.010 265);
  --border-default: oklch(0.80 0.015 265);
  --border-strong:  oklch(0.70 0.020 265);
  --accent-workspace:        oklch(0.50 0.20 285);
  --accent-workspace-bg:     oklch(0.50 0.20 285 / 0.10);
  --accent-workspace-border: oklch(0.50 0.20 285 / 0.25);
  --accent-agent:            oklch(0.45 0.15 200);
  --accent-agent-bg:         oklch(0.45 0.15 200 / 0.10);
  --accent-mcp-bg:           oklch(0.45 0.15 150 / 0.10);
  --status-running:          oklch(0.50 0.15 150);
  --status-error:            oklch(0.45 0.20 25);
  --status-warning:          oklch(0.55 0.18 70);
}

[data-theme="dark-ocean"] {
  /* text tokens same lightness as dark-purple, hue shifted slightly blue */
  --text-primary:   oklch(0.95 0.01 230);
  --text-secondary: oklch(0.65 0.015 230);
  --text-muted:     oklch(0.45 0.015 230);
  --bg-base:        oklch(0.06 0.015 220);
  --bg-surface:     oklch(0.10 0.018 220);
  --bg-elevated:    oklch(0.14 0.020 220);
  --bg-overlay:     oklch(0.18 0.022 220);
  --border-subtle:  oklch(0.16 0.018 220);
  --border-default: oklch(0.22 0.025 220);
  --border-strong:  oklch(0.30 0.030 220);
  --accent-workspace:        oklch(0.65 0.18 220);
  --accent-workspace-bg:     oklch(0.65 0.18 220 / 0.12);
  --accent-workspace-border: oklch(0.65 0.18 220 / 0.30);
  --accent-agent:            oklch(0.72 0.14 190);
  --accent-agent-bg:         oklch(0.72 0.14 190 / 0.12);
  --accent-mcp-bg:           oklch(0.72 0.14 160 / 0.12);
  --status-running:          oklch(0.72 0.14 160);
  --status-error:            oklch(0.65 0.20 25);
  --status-warning:          oklch(0.72 0.18 70);
}

[data-theme="midnight"] {
  /* same text as dark-purple, near-zero chroma surfaces */
  --bg-base:        oklch(0.06 0.002 265);
  --bg-surface:     oklch(0.10 0.003 265);
  --bg-elevated:    oklch(0.14 0.003 265);
  --bg-overlay:     oklch(0.18 0.003 265);
  --border-subtle:  oklch(0.16 0.003 265);
  --border-default: oklch(0.22 0.005 265);
  --border-strong:  oklch(0.30 0.006 265);
  --accent-workspace:        oklch(0.60 0.08 285);
  --accent-workspace-bg:     oklch(0.60 0.08 285 / 0.10);
  --accent-workspace-border: oklch(0.60 0.08 285 / 0.25);
  --accent-agent:            oklch(0.65 0.08 200);
  --accent-agent-bg:         oklch(0.65 0.08 200 / 0.10);
  --accent-mcp-bg:           oklch(0.65 0.08 150 / 0.10);
  --status-running:          oklch(0.65 0.10 150);
  --status-error:            oklch(0.60 0.18 25);
  --status-warning:          oklch(0.65 0.15 70);
}
```

---

## Database & API

### Schema change

```prisma
model User {
  // existing fields...
  theme  String  @default("dark-purple")
}
```

Migration: `npx prisma migrate dev --name add-user-theme`

### New endpoints (in a new `users` NestJS module or added to an existing profile module)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/users/me` | Returns current user profile including `theme` |
| `PATCH` | `/api/users/me` | Accepts `{ theme: string }`, validates against 4 allowed values, updates DB, sets cookie |

**Cookie behaviour:** `Set-Cookie: theme=<value>; Path=/; SameSite=Lax` — `HttpOnly: false` so the inline script can read it. No explicit expiry (session cookie); DB is the source of truth.

**Validation:** Theme value must be one of `['dark-purple', 'light', 'dark-ocean', 'midnight']`. Return 400 for invalid values.

---

## Frontend Components

### `apps/app/components/theme-provider.tsx`

```tsx
'use client';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/components/auth-provider'; // existing auth context

interface ThemeContextValue {
  theme: string;
  setTheme: (t: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children, initialTheme }: { children: ReactNode; initialTheme: string }) {
  const [theme, setThemeState] = useState(initialTheme);
  const { currentUser } = useAuth();
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  const setTheme = (t: string) => {
    document.documentElement.dataset.theme = t;
    // Also update cookie so flash-prevention script picks it up on next hard refresh
    document.cookie = `theme=${t}; path=/; SameSite=Lax`;
    setThemeState(t);
    const user = currentUserRef.current;
    if (user) {
      user.getIdToken().then((token) =>
        fetch('/api/users/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ theme: t }),
        })
      );
    }
  };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
```

### `apps/app/app/[locale]/layout.tsx` changes

1. Add flash-prevention inline script (before `<body>` content):
```tsx
<script dangerouslySetInnerHTML={{ __html:
  `document.documentElement.dataset.theme=document.cookie.match(/(?:^|; )theme=([^;]+)/)?.[1]??'dark-purple'`
}} />
```

2. Read theme cookie server-side and pass as prop to `ThemeProvider`:
```tsx
import { cookies } from 'next/headers';
// inside layout:
const theme = (await cookies()).get('theme')?.value ?? 'dark-purple';
// wrap providers with: <ThemeProvider initialTheme={theme}>
```

### `apps/app/components/providers.tsx`

Add `ThemeProvider` **inside** `AuthProvider` (not wrapping it) so `setTheme` can access the Firebase token for the authenticated PATCH call. `providers.tsx` accepts an `initialTheme: string` prop passed down from `layout.tsx` and forwards it to `ThemeProvider`.

`setTheme` in `ThemeProvider` calls `getIdToken()` on the current Firebase user before the fetch:
```tsx
const { currentUser } = useAuth(); // from AuthProvider context
const token = await currentUser?.getIdToken();
fetch('/api/users/me', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ theme: t }),
});
```

This means the PATCH is fire-and-forget but still authenticated. If the user is not logged in (no `currentUser`), skip the fetch — the cookie still updates correctly via `document.cookie`.

### `apps/app/components/sidebar.tsx` — theme switcher UI

Add a theme section inside the existing user menu popup, above the Sign Out button:

```tsx
const THEMES = [
  { id: 'dark-purple', label: 'Dark Purple', color: 'oklch(0.55 0.20 285)' },
  { id: 'light',       label: 'Light',       color: 'oklch(0.93 0.005 265)', border: true },
  { id: 'dark-ocean',  label: 'Dark Ocean',  color: 'oklch(0.35 0.18 220)' },
  { id: 'midnight',    label: 'Midnight',    color: 'oklch(0.25 0.002 265)', border: true },
];
```

Each swatch: a 14px circle, coloured via `background` inline style, with a 2px ring (`outline`) when it matches the active theme. Tooltip (title attribute) shows the theme name. A divider separates the theme section from Sign Out.

---

## File Checklist

| File | Action |
|------|--------|
| `prisma/schema.prisma` | Add `theme String @default("dark-purple")` to `User` |
| `apps/api/src/modules/users/` | New NestJS module: controller, service, DTO |
| `apps/app/app/globals.css` | Add 3 `[data-theme]` blocks (Light, Ocean, Midnight) |
| `apps/app/components/theme-provider.tsx` | New file |
| `apps/app/app/[locale]/layout.tsx` | Add inline script + cookie read + ThemeProvider |
| `apps/app/components/providers.tsx` | Accept `initialTheme` prop, render ThemeProvider inside AuthProvider |
| `apps/app/components/sidebar.tsx` | Add theme swatches to user menu popup |

---

## Out of Scope

- System preference auto-detection (`prefers-color-scheme`) — user choice in DB takes precedence
- Per-workspace themes
- Custom theme builder
- Animated transitions between themes
