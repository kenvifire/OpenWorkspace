# Theme System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 visual themes (Dark Purple default, Light, Dark Ocean, Midnight) with a theme picker in the sidebar user menu, persisted to the database.

**Architecture:** CSS `[data-theme]` blocks on `<html>` override shadcn CSS custom properties; a `ThemeProvider` context (inside `AuthProvider`) applies the theme, syncs to DB via `PATCH /api/auth/me`, and sets a cookie; an inline script in layout reads the cookie before React hydrates to prevent flash.

**Tech Stack:** Next.js 15, NestJS, Prisma v6, Firebase Auth, class-validator, CSS custom properties (oklch)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `apps/api/prisma/schema.prisma` | Modify | Add `theme` field to `User` |
| `apps/api/src/modules/auth/update-theme.dto.ts` | Create | DTO with validation |
| `apps/api/src/modules/auth/auth.service.ts` | Modify | Add `updateTheme` method |
| `apps/api/src/modules/auth/auth.controller.ts` | Modify | Add `PATCH /auth/me` route |
| `apps/api/src/modules/auth/auth.service.spec.ts` | Create | Unit test for `updateTheme` |
| `apps/app/lib/api.ts` | Modify | Add `updateTheme` to `usersApi` |
| `apps/app/app/globals.css` | Modify | Add 3 `[data-theme]` override blocks |
| `apps/app/contexts/theme.tsx` | Create | `ThemeProvider` + `useTheme` hook |
| `apps/app/components/providers.tsx` | Modify | Accept `initialTheme`, render `ThemeProvider` inside `AuthProvider` |
| `apps/app/app/[locale]/layout.tsx` | Modify | Read cookie, pass `initialTheme`, add flash-prevention script |
| `apps/app/components/sidebar.tsx` | Modify | Theme swatches in user menu popup |

---

### Task 1: Database — add `theme` field to User

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (User model, around line 12)
- Modify: `apps/api/src/modules/tasks/tasks.service.spec.ts` (makeUser factory needs `theme`)
- Modify: `apps/api/src/modules/workspace-keys/workspace-keys.service.spec.ts` (same)
- Modify: `apps/api/src/modules/agent-runner/agent-runner.service.spec.ts` (same)

- [ ] **Step 1: Add the field to schema**

In `apps/api/prisma/schema.prisma`, find the `User` model. Add `theme` after `planningAgentEncryptedApiKey`:

```prisma
model User {
  id        String   @id @default(cuid())
  firebaseUid   String   @unique
  email     String   @unique
  name      String
  avatarUrl                  String?
  totpSecret   String?
  totpEnabled  Boolean  @default(false)
  planningAgentDefaultPrompt   String?  @db.Text
  planningAgentProvider        String?
  planningAgentModel           String?
  planningAgentEncryptedApiKey String?
  theme                        String   @default("dark-purple")
  createdAt                  DateTime @default(now())
  updatedAt                  DateTime @updatedAt

  workspaceMemberships WorkspaceMember[]
  ownedWorkspaces      Workspace[]
  ledProjects          Project[]
  agentProvider        AgentProvider?
  personalAgents       Agent[]          @relation("PersonalAgents")
  skills               Skill[]          @relation("UserSkills")
  mcps                 Mcp[]            @relation("UserMcps")
  reviews              AgentReview[]
}
```

- [ ] **Step 2: Run the migration**

```bash
cd apps/api
npx prisma migrate dev --name add-user-theme
```

Expected: Migration applied, `apps/api/prisma/migrations/` has a new folder ending in `add_user_theme`.

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client` output with no errors.

- [ ] **Step 4: Update test mock factories to include `theme`**

In `apps/api/src/modules/tasks/tasks.service.spec.ts`, find `makeUser` (around line 16) and add `theme`:

```typescript
const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  email: 'test@test.com',
  name: 'Test User',
  firebaseUid: 'firebase-uid-1',
  avatarUrl: null,
  totpSecret: null,
  totpEnabled: false,
  planningAgentDefaultPrompt: null,
  planningAgentProvider: null,
  planningAgentModel: null,
  planningAgentEncryptedApiKey: null,
  theme: 'dark-purple',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});
```

Apply the same `theme: 'dark-purple'` addition to any `makeUser` or equivalent factory in:
- `apps/api/src/modules/workspace-keys/workspace-keys.service.spec.ts`
- `apps/api/src/modules/agent-runner/agent-runner.service.spec.ts`

Search command to find all factories needing update:
```bash
grep -rn "makeUser\|planningAgentEncryptedApiKey" apps/api/src --include="*.spec.ts"
```

- [ ] **Step 5: Verify existing tests still pass**

```bash
cd apps/api
npx jest --passWithNoTests 2>&1 | tail -20
```

Expected: All tests pass (PASS or no failures).

- [ ] **Step 6: Commit**

```bash
cd apps/api
git add prisma/schema.prisma prisma/migrations/ src/modules/tasks/tasks.service.spec.ts src/modules/workspace-keys/workspace-keys.service.spec.ts src/modules/agent-runner/agent-runner.service.spec.ts
git commit -m "feat: add theme field to User model"
```

---

### Task 2: API — PATCH /auth/me endpoint

**Files:**
- Create: `apps/api/src/modules/auth/update-theme.dto.ts`
- Create: `apps/api/src/modules/auth/auth.service.spec.ts`
- Modify: `apps/api/src/modules/auth/auth.service.ts`
- Modify: `apps/api/src/modules/auth/auth.controller.ts`
- Modify: `apps/app/lib/api.ts`

- [ ] **Step 1: Write the failing unit test**

Create `apps/api/src/modules/auth/auth.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService.updateTheme', () => {
  let service: AuthService;
  let prisma: { user: { update: jest.Mock } };

  beforeEach(async () => {
    prisma = { user: { update: jest.fn() } };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
  });

  it('updates the theme field for the given user id', async () => {
    prisma.user.update.mockResolvedValue({ id: 'u1', theme: 'dark-ocean' });

    const result = await service.updateTheme('u1', 'dark-ocean');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { theme: 'dark-ocean' },
    });
    expect(result.theme).toBe('dark-ocean');
  });
});
```

- [ ] **Step 2: Run the test — verify it fails**

```bash
cd apps/api
npx jest auth.service.spec.ts --no-coverage
```

Expected: FAIL — `service.updateTheme is not a function` (method not implemented yet).

- [ ] **Step 3: Create the DTO**

Create `apps/api/src/modules/auth/update-theme.dto.ts`:

```typescript
import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const VALID_THEMES = ['dark-purple', 'light', 'dark-ocean', 'midnight'] as const;
export type Theme = typeof VALID_THEMES[number];

export class UpdateThemeDto {
  @ApiProperty({ enum: VALID_THEMES })
  @IsIn(VALID_THEMES)
  theme: Theme;
}
```

- [ ] **Step 4: Add `updateTheme` to AuthService**

Replace the full content of `apps/api/src/modules/auth/auth.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserByFirebaseUid(firebaseUid: string) {
    return this.prisma.user.findUnique({ where: { firebaseUid } });
  }

  async updateTheme(userId: string, theme: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { theme },
    });
  }
}
```

- [ ] **Step 5: Run the test — verify it passes**

```bash
cd apps/api
npx jest auth.service.spec.ts --no-coverage
```

Expected: PASS — 1 test passes.

- [ ] **Step 6: Add PATCH /auth/me to the controller**

Replace the full content of `apps/api/src/modules/auth/auth.controller.ts`:

```typescript
import { Controller, Get, Patch, Body, UseGuards, Request, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateThemeDto } from './update-theme.dto';
import type { User } from '@prisma/client';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Return the current authenticated user' })
  me(@Request() req: { user: unknown }) {
    return req.user;
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user theme preference' })
  async updateTheme(
    @CurrentUser() user: User,
    @Body() dto: UpdateThemeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const updated = await this.authService.updateTheme(user.id, dto.theme);
    res.cookie('theme', dto.theme, { path: '/', sameSite: 'lax', httpOnly: false });
    return updated;
  }
}
```

- [ ] **Step 7: Verify the API compiles**

```bash
cd apps/api
pnpm run build 2>&1 | tail -20
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 8: Add `updateTheme` to the frontend API client**

In `apps/app/lib/api.ts`, find the `usersApi` object (around line 191) and add `updateTheme`:

```typescript
export const usersApi = {
  me: (): Promise<{ id: string; email: string; name: string; totpEnabled: boolean; theme: string }> =>
    api.get('/api/auth/me').then((r) => r.data),
  updateTheme: (theme: string): Promise<void> =>
    api.patch('/api/auth/me', { theme }).then((r) => r.data),
};
```

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/modules/auth/ apps/app/lib/api.ts
git commit -m "feat: add PATCH /auth/me endpoint for theme preference"
```

---

### Task 3: CSS — theme token blocks

**Files:**
- Modify: `apps/app/app/globals.css`

The current `:root` block uses shadcn tokens (`--background`, `--foreground`, `--card`, etc.). Each theme block overrides the same set of tokens.

- [ ] **Step 1: Add the three theme blocks at the end of globals.css**

Open `apps/app/app/globals.css` and append the following after the closing `}` of the `@layer base` block (after the last `}`):

```css
/* ─── Light theme ──────────────────────────────────────────────────────────── */
[data-theme="light"] {
  --background: oklch(0.97 0.005 265);
  --foreground: oklch(0.15 0.015 265);
  --card: oklch(1.00 0.000 0);
  --card-foreground: oklch(0.15 0.015 265);
  --popover: oklch(1.00 0.000 0);
  --popover-foreground: oklch(0.15 0.015 265);
  --primary: oklch(0.52 0.22 285);
  --primary-foreground: oklch(0.98 0.005 285);
  --secondary: oklch(0.92 0.008 265);
  --secondary-foreground: oklch(0.15 0.015 265);
  --muted: oklch(0.92 0.008 265);
  --muted-foreground: oklch(0.50 0.020 265);
  --accent: oklch(0.52 0.14 210);
  --accent-foreground: oklch(0.98 0.005 265);
  --destructive: oklch(0.52 0.22 25);
  --border: oklch(0.84 0.012 265);
  --input: oklch(0.84 0.012 265);
  --ring: oklch(0.52 0.22 285);
  --chart-1: oklch(0.52 0.22 285);
  --chart-2: oklch(0.52 0.14 210);
  --chart-3: oklch(0.55 0.16 150);
  --chart-4: oklch(0.60 0.18 55);
  --chart-5: oklch(0.52 0.20 25);
  --sidebar: oklch(0.93 0.006 265);
  --sidebar-foreground: oklch(0.15 0.015 265);
  --sidebar-primary: oklch(0.52 0.22 285);
  --sidebar-primary-foreground: oklch(0.98 0.005 285);
  --sidebar-accent: oklch(0.88 0.010 265);
  --sidebar-accent-foreground: oklch(0.15 0.015 265);
  --sidebar-border: oklch(0.84 0.012 265);
  --sidebar-ring: oklch(0.52 0.22 285);
}

/* ─── Dark Ocean theme ─────────────────────────────────────────────────────── */
[data-theme="dark-ocean"] {
  --background: oklch(0.09 0.015 220);
  --foreground: oklch(0.95 0.010 220);
  --card: oklch(0.12 0.018 220);
  --card-foreground: oklch(0.95 0.010 220);
  --popover: oklch(0.12 0.018 220);
  --popover-foreground: oklch(0.95 0.010 220);
  --primary: oklch(0.62 0.18 220);
  --primary-foreground: oklch(0.98 0.005 220);
  --secondary: oklch(0.15 0.018 220);
  --secondary-foreground: oklch(0.95 0.010 220);
  --muted: oklch(0.15 0.018 220);
  --muted-foreground: oklch(0.55 0.020 220);
  --accent: oklch(0.72 0.14 190);
  --accent-foreground: oklch(0.09 0.015 220);
  --destructive: oklch(0.58 0.22 25);
  --border: oklch(0.22 0.022 220);
  --input: oklch(0.22 0.022 220);
  --ring: oklch(0.62 0.18 220);
  --chart-1: oklch(0.62 0.18 220);
  --chart-2: oklch(0.72 0.14 190);
  --chart-3: oklch(0.72 0.16 150);
  --chart-4: oklch(0.75 0.18 55);
  --chart-5: oklch(0.65 0.20 25);
  --sidebar: oklch(0.085 0.015 220);
  --sidebar-foreground: oklch(0.95 0.010 220);
  --sidebar-primary: oklch(0.62 0.18 220);
  --sidebar-primary-foreground: oklch(0.98 0.005 220);
  --sidebar-accent: oklch(0.15 0.018 220);
  --sidebar-accent-foreground: oklch(0.95 0.010 220);
  --sidebar-border: oklch(0.22 0.022 220);
  --sidebar-ring: oklch(0.62 0.18 220);
}

/* ─── Midnight theme ───────────────────────────────────────────────────────── */
[data-theme="midnight"] {
  --background: oklch(0.09 0.002 265);
  --foreground: oklch(0.92 0.005 265);
  --card: oklch(0.12 0.003 265);
  --card-foreground: oklch(0.92 0.005 265);
  --popover: oklch(0.12 0.003 265);
  --popover-foreground: oklch(0.92 0.005 265);
  --primary: oklch(0.58 0.10 285);
  --primary-foreground: oklch(0.98 0.005 285);
  --secondary: oklch(0.15 0.003 265);
  --secondary-foreground: oklch(0.92 0.005 265);
  --muted: oklch(0.15 0.003 265);
  --muted-foreground: oklch(0.52 0.008 265);
  --accent: oklch(0.65 0.08 200);
  --accent-foreground: oklch(0.09 0.002 265);
  --destructive: oklch(0.55 0.20 25);
  --border: oklch(0.20 0.004 265);
  --input: oklch(0.20 0.004 265);
  --ring: oklch(0.58 0.10 285);
  --chart-1: oklch(0.58 0.10 285);
  --chart-2: oklch(0.65 0.08 200);
  --chart-3: oklch(0.65 0.10 150);
  --chart-4: oklch(0.68 0.12 55);
  --chart-5: oklch(0.58 0.16 25);
  --sidebar: oklch(0.085 0.002 265);
  --sidebar-foreground: oklch(0.92 0.005 265);
  --sidebar-primary: oklch(0.58 0.10 285);
  --sidebar-primary-foreground: oklch(0.98 0.005 285);
  --sidebar-accent: oklch(0.15 0.003 265);
  --sidebar-accent-foreground: oklch(0.92 0.005 265);
  --sidebar-border: oklch(0.20 0.004 265);
  --sidebar-ring: oklch(0.58 0.10 285);
}
```

- [ ] **Step 2: Manually smoke test the CSS**

Start the dev server: `cd apps/app && pnpm dev`

Open `http://localhost:3000` in the browser. In DevTools console, run:
```js
document.documentElement.dataset.theme = 'light'
```
Expected: App turns light-coloured immediately.

Run:
```js
document.documentElement.dataset.theme = 'dark-ocean'
```
Expected: App takes on blue-tinted surfaces.

Run:
```js
document.documentElement.dataset.theme = 'midnight'
```
Expected: App shows near-neutral grey tones.

Run:
```js
delete document.documentElement.dataset.theme
```
Expected: App returns to default Dark Purple.

- [ ] **Step 3: Commit**

```bash
git add apps/app/app/globals.css
git commit -m "feat: add light, dark-ocean, and midnight theme CSS blocks"
```

---

### Task 4: ThemeProvider + Providers wiring + flash prevention

**Files:**
- Create: `apps/app/contexts/theme.tsx`
- Modify: `apps/app/components/providers.tsx`
- Modify: `apps/app/app/[locale]/layout.tsx`

- [ ] **Step 1: Create ThemeProvider**

Create `apps/app/contexts/theme.tsx`:

```tsx
'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/contexts/auth';
import { usersApi } from '@/lib/api';

interface ThemeContextValue {
  theme: string;
  setTheme: (t: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const VALID_THEMES = ['dark-purple', 'light', 'dark-ocean', 'midnight'] as const;

export function ThemeProvider({ children, initialTheme }: { children: ReactNode; initialTheme: string }) {
  const [theme, setThemeState] = useState(initialTheme);
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const setTheme = (t: string) => {
    document.documentElement.dataset.theme = t;
    // Sync cookie client-side so flash-prevention script picks it up on next hard refresh
    document.cookie = `theme=${t}; path=/; SameSite=Lax`;
    setThemeState(t);
    getTokenRef.current().then((token) => {
      if (!token) return;
      usersApi.updateTheme(t);
    });
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

- [ ] **Step 2: Update `providers.tsx` to accept `initialTheme` and render ThemeProvider**

Replace the full content of `apps/app/components/providers.tsx`:

```tsx
'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AbstractIntlMessages, NextIntlClientProvider } from 'next-intl';
import { queryClient } from '@/lib/query-client';
import { AuthProvider } from '@/contexts/auth';
import { ThemeProvider } from '@/contexts/theme';
import { useEffect } from 'react';

interface ProvidersProps {
  children: React.ReactNode;
  locale: string;
  messages: AbstractIntlMessages;
  lang?: string;
  initialTheme: string;
}

export function Providers({ children, locale, messages, lang, initialTheme }: ProvidersProps) {
  useEffect(() => {
    if (lang) {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    }
  }, [lang]);

  return (
    <AuthProvider>
      <ThemeProvider initialTheme={initialTheme}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <QueryClientProvider client={queryClient}>
            {children}
            {process.env.NODE_ENV === 'development' && <ReactQueryDevtools />}
          </QueryClientProvider>
        </NextIntlClientProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
```

- [ ] **Step 3: Update `layout.tsx` to read cookie + pass `initialTheme` + add flash script**

Replace the full content of `apps/app/app/[locale]/layout.tsx`:

```tsx
import { cookies } from 'next/headers';
import { getMessages } from 'next-intl/server';
import { Providers } from '@/components/providers';
import { locales } from '@/i18n';
import type { Locale } from '@/i18n';
import { notFound } from 'next/navigation';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) notFound();

  const messages = await getMessages({ locale });
  const cookieStore = await cookies();
  const initialTheme = cookieStore.get('theme')?.value ?? 'dark-purple';

  return (
    <>
      {/* Runs before React hydration — prevents flash of wrong theme */}
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.dataset.theme=document.cookie.match(/(?:^|; )theme=([^;]+)/)?.[1]??'dark-purple'`,
        }}
      />
      <Providers locale={locale} messages={messages} lang={locale} initialTheme={initialTheme}>
        {children}
      </Providers>
    </>
  );
}
```

- [ ] **Step 4: Verify the app builds without TypeScript errors**

```bash
cd apps/app
pnpm run build 2>&1 | tail -30
```

Expected: Build completes with no TypeScript or Next.js errors.

- [ ] **Step 5: Verify flash prevention works**

1. Start the dev server: `cd apps/app && pnpm dev`
2. Open `http://localhost:3000` — sign in if needed
3. Open DevTools → Application → Cookies. Set `theme = dark-ocean` manually
4. Hard-refresh the page (Cmd+Shift+R)
5. Expected: Page loads with blue-tinted ocean theme immediately, no flash of purple

- [ ] **Step 6: Commit**

```bash
git add apps/app/contexts/theme.tsx apps/app/components/providers.tsx apps/app/app/\[locale\]/layout.tsx
git commit -m "feat: add ThemeProvider context and wire up flash prevention"
```

---

### Task 5: Sidebar theme switcher UI

**Files:**
- Modify: `apps/app/components/sidebar.tsx`

The user menu popup is at `sidebar.tsx` around line 285–307. It currently has: a Settings link, a divider, and a Sign Out button.

We add a theme section above the divider: a row of 4 color swatches, with the active one ringed.

- [ ] **Step 1: Add the import for `useTheme`**

At the top of `apps/app/components/sidebar.tsx`, add the import alongside the existing imports:

```tsx
import { useTheme } from '@/contexts/theme';
```

- [ ] **Step 2: Add the `THEMES` constant and `useTheme` hook call**

In the component body, after `const { user, signOut } = useAuth();` (around line 32), add:

```tsx
const { theme, setTheme } = useTheme();

const THEMES: { id: string; label: string; color: string; border?: boolean }[] = [
  { id: 'dark-purple', label: 'Dark Purple', color: 'oklch(0.55 0.20 285)' },
  { id: 'light',       label: 'Light',       color: 'oklch(0.93 0.005 265)', border: true },
  { id: 'dark-ocean',  label: 'Dark Ocean',  color: 'oklch(0.35 0.18 220)' },
  { id: 'midnight',    label: 'Midnight',    color: 'oklch(0.25 0.002 265)', border: true },
];
```

- [ ] **Step 3: Add the theme swatch section to the user menu popup**

Find the user menu popup content (around line 297–305):

```tsx
<Link href={`/${locale}/settings`} onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors">
  <Settings size={14} className="text-zinc-500" />{t('settings')}
</Link>
<div className={cn('mx-3 border-t', BORDER)} />
<button onClick={handleSignOut} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-zinc-300 hover:bg-white/5 hover:text-red-400 transition-colors">
  <LogOut size={14} className="text-zinc-500" />{t('signOut')}
</button>
```

Replace it with:

```tsx
<Link href={`/${locale}/settings`} onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors">
  <Settings size={14} className="text-zinc-500" />{t('settings')}
</Link>
<div className={cn('mx-3 border-t', BORDER)} />
<div className="px-3 py-2">
  <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">Theme</p>
  <div className="flex gap-2">
    {THEMES.map((t) => (
      <button
        key={t.id}
        title={t.label}
        onClick={() => setTheme(t.id)}
        style={{ background: t.color }}
        className={cn(
          'h-4 w-4 rounded-full transition-all',
          t.border && 'ring-1 ring-zinc-600',
          theme === t.id
            ? 'outline outline-2 outline-offset-2 outline-white/70'
            : 'opacity-70 hover:opacity-100',
        )}
      />
    ))}
  </div>
</div>
<div className={cn('mx-3 border-t', BORDER)} />
<button onClick={handleSignOut} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-zinc-300 hover:bg-white/5 hover:text-red-400 transition-colors">
  <LogOut size={14} className="text-zinc-500" />{t('signOut')}
</button>
```

Note: The `t` variable in the `THEMES.map` shadows the `t` from `useTranslations`. Rename the map parameter to avoid the clash:

```tsx
{THEMES.map((th) => (
  <button
    key={th.id}
    title={th.label}
    onClick={() => setTheme(th.id)}
    style={{ background: th.color }}
    className={cn(
      'h-4 w-4 rounded-full transition-all',
      th.border && 'ring-1 ring-zinc-600',
      theme === th.id
        ? 'outline outline-2 outline-offset-2 outline-white/70'
        : 'opacity-70 hover:opacity-100',
    )}
  />
))}
```

- [ ] **Step 4: Verify the app compiles**

```bash
cd apps/app
pnpm run build 2>&1 | tail -20
```

Expected: No TypeScript errors.

- [ ] **Step 5: Manual end-to-end test**

1. Start api and app: from repo root run `pnpm dev`
2. Open `http://localhost:3000`, sign in
3. Click your avatar in the sidebar footer
4. Expected: User menu opens, shows a "Theme" section with 4 colored circles. The active theme (Dark Purple) has a white outline ring.
5. Click the Light swatch
6. Expected: App immediately switches to light surfaces, the light circle gets an outline ring
7. Hard-refresh the page
8. Expected: App stays on the Light theme (cookie persisted it)
9. Check the DB: `select theme from "User" where email = '<your email>';`
10. Expected: `theme = 'light'`

- [ ] **Step 6: Commit**

```bash
git add apps/app/components/sidebar.tsx
git commit -m "feat: add theme switcher swatches to sidebar user menu"
```
