# apps/website — Marketing Landing Page

## Overview

A static Next.js site that serves as the public-facing marketing page for OpenWorkspace. It has no authentication, no API calls at runtime, and no client-side JavaScript beyond Next.js hydration. All pages are prerendered as static HTML at build time.

- **Port**: 3002
- **Framework**: Next.js 16 (App Router, Turbopack)
- **Styling**: Tailwind v4 (CSS-first) + shared `@openworkspace/ui` components
- **Output**: Static (`○` routes only) — suitable for CDN deployment

---

## Page Structure

Single route: `/` (`app/page.tsx`).

The page is composed of 7 inline components rendered in sequence:

| Component | Description |
|-----------|-------------|
| `Nav` | Sticky header — logo, nav links (Features, How it works, Pricing), Sign in + Get started CTAs |
| `Hero` | Headline, sub-headline, two CTA buttons, fake Kanban board preview |
| `Features` | 6 feature cards with Lucide icons (Bot, Users, Kanban, Zap, ShieldCheck, BarChart3) |
| `HowItWorks` | 4-step numbered guide (01–04) |
| `Testimonials` | 3 testimonial cards with star ratings |
| `Pricing` | 3-plan pricing grid (Starter free, Pro $49/mo highlighted, Enterprise custom) |
| `CTA` | Dark full-width banner — "Ready to build with AI agents?" |
| `Footer` | Logo, Privacy / Terms / Docs links, copyright |

---

## CTA Links

All sign-in and get-started buttons link to `${NEXT_PUBLIC_APP_URL}/sign-in`. The URL is resolved at build time from the environment variable, defaulting to `http://localhost:3000`.

```typescript
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
```

---

## Shared Components Used

From `@openworkspace/ui`:
- `Badge` — "Now in public beta" badge in the Hero section
- `Button` — all CTA buttons, nav buttons
- `Card`, `CardContent`, `CardHeader`, `CardTitle` — feature cards, testimonial cards, pricing cards
- `Separator` — horizontal rule in testimonial cards

Icons from `lucide-react` (v0.577+): `Bot`, `Users`, `Kanban`, `Zap`, `ShieldCheck`, `BarChart3`, `ArrowRight`, `Star`, `CheckCircle2`.

> Note: `LayoutKanban` was removed in lucide-react v0.277+. Use `Kanban` instead.

---

## Build

```bash
cd apps/website
pnpm run build   # outputs 2 static routes: / and /_not-found
```

Turbopack is used for both dev and build. The stray `package-lock.json` (if present) should be deleted — it conflicts with the pnpm workspace lockfile and triggers a Next.js warning.

---

## Deployment

Because all routes are static, the site can be deployed to any CDN (Vercel, Cloudflare Pages, S3 + CloudFront). Set `NEXT_PUBLIC_APP_URL` to the production app URL at build time.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_APP_URL` | No | App URL for CTA links (default `http://localhost:3000`) |
