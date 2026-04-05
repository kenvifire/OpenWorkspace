'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  LayoutDashboard, Store, CreditCard, Settings, ChevronDown,
  Plus, LogOut, Bot, Zap, Server, Brain, PanelLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { workspacesApi, myAgentsApi, skillsApi, mcpsApi } from '@/lib/api';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/auth';
import { motion, AnimatePresence } from 'framer-motion';

const WORKSPACE_COLORS = [
  'bg-violet-500', 'bg-sky-500', 'bg-emerald-500',
  'bg-orange-500', 'bg-pink-500', 'bg-indigo-500',
];

const BORDER = 'border-[oklch(0.22_0.02_265)]';
const BG = 'bg-[oklch(0.085_0.012_265)]';
const SURFACE = 'bg-[oklch(0.12_0.014_265)]';

export function Sidebar() {
  const pathname = usePathname();
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations('nav');
  const { user, signOut } = useAuth();

  // Collapse state — persisted
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar-collapsed') === 'true';
    }
    return false;
  });

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      if (typeof window !== 'undefined') localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  };

  // Section open state (only relevant when expanded)
  const [workspacesOpen, setWorkspacesOpen] = useState(true);
  const [agentsOpen, setAgentsOpen] = useState(true);
  const [skillsOpen, setSkillsOpen] = useState(true);
  const [mcpsOpen, setMcpsOpen] = useState(true);

  // User menu
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

  const Label = ({ children }: { children: React.ReactNode }) => (
    <AnimatePresence initial={false}>
      {!collapsed && (
        <motion.span
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: 'auto' }}
          exit={{ opacity: 0, width: 0 }}
          transition={{ duration: 0.15 }}
          className="truncate overflow-hidden whitespace-nowrap"
        >
          {children}
        </motion.span>
      )}
    </AnimatePresence>
  );

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r shrink-0 overflow-hidden',
        'transition-[width] duration-[220ms] ease-[cubic-bezier(0.4,0,0.2,1)]',
        collapsed ? 'w-16' : 'w-60',
        BORDER, BG,
      )}
    >
      {/* Top: toggle + brand */}
      <div className={cn('flex items-center py-4 px-3', collapsed ? 'justify-center' : 'justify-between gap-2')}>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2.5 pl-1"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500 shadow-[0_0_12px_oklch(0.68_0.18_285/0.5)]">
              <span className="text-[11px] font-bold text-white" style={{ fontFamily: 'var(--font-syne)' }}>OW</span>
            </div>
            <span className="text-sm font-bold tracking-tight text-white whitespace-nowrap" style={{ fontFamily: 'var(--font-syne)' }}>
              OpenWorkspace
            </span>
          </motion.div>
        )}
        <button
          onClick={toggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-white/5 hover:text-zinc-300 transition-colors"
        >
          <PanelLeft size={16} />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 pb-2">

        {/* Main nav */}
        <nav className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'relative flex items-center rounded-lg py-2 text-sm font-medium transition-colors',
                  collapsed ? 'justify-center px-2' : 'gap-2.5 px-2.5',
                  active
                    ? 'bg-violet-500/10 text-violet-300'
                    : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200',
                )}
              >
                {active && !collapsed && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-violet-400" />
                )}
                <Icon size={16} className={active ? 'text-violet-400 shrink-0' : 'shrink-0'} />
                <Label>{item.label}</Label>
              </Link>
            );
          })}
        </nav>

        {/* Sections — only when expanded */}
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {/* Workspaces */}
              <Section label="Workspaces" open={workspacesOpen} onToggle={() => setWorkspacesOpen(o => !o)}>
                {(workspaces as any[]).map((ws, i) => (
                  <Link
                    key={ws.id}
                    href={`/${locale}/workspaces/${ws.slug}`}
                    className={cn(
                      'relative flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                      pathname.includes(`/workspaces/${ws.slug}`)
                        ? 'bg-violet-500/10 font-medium text-violet-300'
                        : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200',
                    )}
                  >
                    {pathname.includes(`/workspaces/${ws.slug}`) && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r bg-violet-400" />
                    )}
                    <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold uppercase text-white', WORKSPACE_COLORS[i % WORKSPACE_COLORS.length])}>
                      {ws.name[0]}
                    </span>
                    <span className="truncate">{ws.name}</span>
                  </Link>
                ))}
                <Link href={`/${locale}/workspaces/new`} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-zinc-500 hover:bg-white/5 hover:text-zinc-300 transition-colors">
                  <Plus size={13} />New workspace
                </Link>
              </Section>

              {/* Agents */}
              <Section label="Agents" open={agentsOpen} onToggle={() => setAgentsOpen(o => !o)}>
                <Link href={`/${locale}/agents`} className={cn('relative flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors', pathname === `/${locale}/agents` ? 'bg-violet-500/10 font-medium text-violet-300' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200')}>
                  {pathname === `/${locale}/agents` && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r bg-violet-400" />}
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-violet-500/20 text-violet-400"><Brain size={11} /></span>
                  <span className="truncate">Planning Agent</span>
                </Link>
                {(agents as any[]).map((agent) => (
                  <Link key={agent.id} href={`/${locale}/agents`} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-zinc-400 hover:bg-white/5 hover:text-zinc-200 transition-colors">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[oklch(0.75_0.15_210/0.15)] text-[oklch(0.75_0.15_210)]"><Bot size={11} /></span>
                    <span className="truncate">{agent.name}</span>
                  </Link>
                ))}
                <Link href={`/${locale}/agents`} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-zinc-500 hover:bg-white/5 hover:text-zinc-300 transition-colors">
                  <Plus size={13} />New agent
                </Link>
              </Section>

              {/* Skills */}
              <Section label="Skills" open={skillsOpen} onToggle={() => setSkillsOpen(o => !o)}>
                {(skills as any[]).map((skill) => (
                  <Link key={skill.id} href={`/${locale}/skills`} className={cn('flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors', pathname === `/${locale}/skills` ? 'bg-violet-500/10 font-medium text-violet-300' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200')}>
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-amber-500/20 text-amber-400"><Zap size={11} /></span>
                    <span className="truncate">{skill.name}</span>
                  </Link>
                ))}
                <Link href={`/${locale}/skills`} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-zinc-500 hover:bg-white/5 hover:text-zinc-300 transition-colors">
                  <Plus size={13} />New skill
                </Link>
              </Section>

              {/* MCP */}
              <Section label="MCP Servers" open={mcpsOpen} onToggle={() => setMcpsOpen(o => !o)}>
                {(mcps as any[]).map((mcp) => (
                  <Link key={mcp.id} href={`/${locale}/mcp`} className={cn('flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors', pathname === `/${locale}/mcp` ? 'bg-violet-500/10 font-medium text-violet-300' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200')}>
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-indigo-500/20 text-indigo-400"><Server size={11} /></span>
                    <span className="truncate">{mcp.name}</span>
                  </Link>
                ))}
                <Link href={`/${locale}/mcp`} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-zinc-500 hover:bg-white/5 hover:text-zinc-300 transition-colors">
                  <Plus size={13} />New MCP
                </Link>
              </Section>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* User */}
      <div className={cn('border-t py-3 px-2', BORDER)}>
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen(o => !o)}
            title={collapsed ? (user?.displayName || user?.email || 'Account') : undefined}
            className={cn(
              'flex w-full items-center rounded-lg py-2 hover:bg-white/5 transition-colors',
              collapsed ? 'justify-center px-2' : 'gap-2.5 px-2',
            )}
          >
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-[oklch(0.22_0.02_265)]" />
            ) : (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-xs font-semibold text-violet-300">
                {user?.displayName?.[0] ?? user?.email?.[0] ?? '?'}
              </span>
            )}
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex min-w-0 flex-1 items-center justify-between overflow-hidden"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-200">
                      {user?.displayName || user?.email?.split('@')[0] || 'Account'}
                    </p>
                    <p className="truncate text-xs text-zinc-500">{user?.email}</p>
                  </div>
                  <Settings size={14} className="shrink-0 text-zinc-500 ml-2" />
                </motion.div>
              )}
            </AnimatePresence>
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97 }}
                transition={{ duration: 0.12 }}
                className={cn(
                  'absolute bottom-full mb-1 overflow-hidden rounded-xl border shadow-xl shadow-black/40',
                  BORDER, SURFACE,
                  collapsed ? 'left-0 w-48' : 'left-0 right-0',
                )}
              >
                <Link href={`/${locale}/settings`} onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors">
                  <Settings size={14} className="text-zinc-500" />Settings
                </Link>
                <div className={cn('mx-3 border-t', BORDER)} />
                <button onClick={handleSignOut} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-zinc-300 hover:bg-white/5 hover:text-red-400 transition-colors">
                  <LogOut size={14} className="text-zinc-500" />Sign out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </aside>
  );
}

function Section({ label, open, onToggle, children }: {
  label: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="mt-5">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        {label}
        <motion.div animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={11} />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="mt-1 flex flex-col gap-0.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
