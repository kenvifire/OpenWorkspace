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
import { workspacesApi, myAgentsApi, skillsApi, mcpsApi, type Skill, type Mcp } from '@/lib/api';
import type { Workspace, Agent } from '@openworkspace/api-types';
import { useRef, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth';
import { useTheme } from '@/contexts/theme';
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
  const { theme, setTheme } = useTheme();

  const THEMES: { id: string; label: string; color: string; border?: boolean }[] = [
    { id: 'dark-purple', label: 'Dark Purple', color: 'oklch(0.55 0.20 285)' },
    { id: 'light',       label: 'Light',       color: 'oklch(0.93 0.005 265)', border: true },
    { id: 'dark-ocean',  label: 'Dark Ocean',  color: 'oklch(0.35 0.18 220)' },
    { id: 'midnight',    label: 'Midnight',    color: 'oklch(0.25 0.002 265)', border: true },
  ];

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
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-workspace)] shadow-[0_0_12px_var(--accent-workspace-glow)]">
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
          {(workspaces as Workspace[]).map((ws, i) => {
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
                    {ws._count?.projects}
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
          {(agents as Agent[]).map((agent) => (
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
          {(skills as Skill[]).map((skill) => (
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
          {(mcps as Mcp[]).map((mcp) => (
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
                <div className="px-3 py-2">
                  <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Theme</p>
                  <div className="flex gap-2">
                    {THEMES.map((th) => (
                      <button
                        key={th.id}
                        title={th.label}
                        onClick={() => setTheme(th.id)}
                        style={{ background: th.color }}
                        className={cn(
                          'h-4 w-4 rounded-full transition-all',
                          th.border && 'ring-1 ring-[var(--border-default)]',
                          theme === th.id
                            ? 'outline outline-2 outline-offset-2 outline-[var(--text-primary)]/70'
                            : 'opacity-70 hover:opacity-100',
                        )}
                      />
                    ))}
                  </div>
                </div>
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
