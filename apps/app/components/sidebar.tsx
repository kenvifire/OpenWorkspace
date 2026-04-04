'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  LayoutDashboard, Store, CreditCard, Settings, ChevronDown, Plus, LogOut, Bot, Zap, Server, Brain,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { workspacesApi, myAgentsApi, skillsApi, mcpsApi } from '@/lib/api';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/auth';
import { motion, AnimatePresence } from 'framer-motion';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const sectionVariants = {
  open: { height: 'auto', opacity: 1, transition: { duration: 0.2, ease: 'easeOut' as const } },
  closed: { height: 0, opacity: 0, transition: { duration: 0.15, ease: 'easeIn' as const } },
};

const WORKSPACE_COLORS = [
  'bg-violet-500',
  'bg-sky-500',
  'bg-emerald-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-indigo-500',
];

export function Sidebar() {
  const pathname = usePathname();
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations('nav');
  const [workspacesOpen, setWorkspacesOpen] = useState(true);
  const [agentsOpen, setAgentsOpen] = useState(true);
  const [skillsOpen, setSkillsOpen] = useState(true);
  const [mcpsOpen, setMcpsOpen] = useState(true);
  const { user, signOut } = useAuth();

  const { data: workspaces = [] } = useQuery({
    queryKey: ['workspaces'],
    queryFn: workspacesApi.list,
    enabled: !!user,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['my-agents'],
    queryFn: myAgentsApi.list,
    enabled: !!user,
  });

  const { data: skills = [] } = useQuery({
    queryKey: ['my-skills'],
    queryFn: skillsApi.list,
    enabled: !!user,
  });

  const { data: mcps = [] } = useQuery({
    queryKey: ['my-mcps'],
    queryFn: mcpsApi.list,
    enabled: !!user,
  });

  const navItems: NavItem[] = [
    { label: t('dashboard'), href: `/${locale}/dashboard`, icon: <LayoutDashboard size={15} /> },
    { label: t('marketplace'), href: `/${locale}/marketplace`, icon: <Store size={15} /> },
    { label: t('billing'), href: `/${locale}/billing`, icon: <CreditCard size={15} /> },
  ];

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleSignOut = async () => {
    await signOut();
    router.push(`/${locale}/sign-in`);
  };

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-[oklch(0.22_0.02_265)] bg-[oklch(0.085_0.012_265)] px-3 py-4 overflow-y-auto shrink-0">
      {/* Brand */}
      <div className="mb-6 px-2 pt-1 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500 shadow-[0_0_12px_oklch(0.68_0.18_285/0.5)]">
          <span className="text-xs font-bold text-white" style={{ fontFamily: 'var(--font-syne), system-ui, sans-serif' }}>OW</span>
        </div>
        <span className="text-sm font-bold tracking-tight text-white" style={{ fontFamily: 'var(--font-syne), system-ui, sans-serif' }}>OpenWorkspace</span>
      </div>

      {/* Main nav */}
      <nav className="flex flex-col gap-0.5">
        {navItems.map((item, i) => {
          const active = pathname === item.href;
          return (
            <motion.div key={item.href} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04, duration: 0.18 }}>
              <Link
                href={item.href}
                className={cn(
                  'relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-violet-500/10 text-violet-300'
                    : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200',
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-violet-400" />
                )}
                <span className={active ? 'text-violet-400' : ''}>{item.icon}</span>
                {item.label}
              </Link>
            </motion.div>
          );
        })}
      </nav>

      {/* Workspaces */}
      <SidebarSection
        label="Workspaces"
        open={workspacesOpen}
        onToggle={() => setWorkspacesOpen((o) => !o)}
      >
        {(workspaces as any[]).map((ws, i) => (
          <motion.div key={ws.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04, duration: 0.18 }}>
            <Link
              href={`/${locale}/workspaces/${ws.slug}`}
              className={cn(
                'relative flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                pathname.includes(`/workspaces/${ws.slug}`)
                  ? 'bg-violet-500/10 font-medium text-violet-300'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200',
              )}
            >
              {pathname.includes(`/workspaces/${ws.slug}`) && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-violet-400" />
              )}
              <span className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold uppercase text-white',
                WORKSPACE_COLORS[i % WORKSPACE_COLORS.length],
              )}>
                {ws.name[0]}
              </span>
              <span className="truncate">{ws.name}</span>
            </Link>
          </motion.div>
        ))}
        <Link
          href={`/${locale}/workspaces/new`}
          className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-zinc-500 hover:bg-white/5 hover:text-zinc-300 transition-colors"
        >
          <Plus size={13} />
          New workspace
        </Link>
      </SidebarSection>

      {/* Agents */}
      <SidebarSection
        label="Agents"
        open={agentsOpen}
        onToggle={() => setAgentsOpen((o) => !o)}
      >
        {/* Planning Agent — fixed built-in entry */}
        <Link
          href={`/${locale}/agents`}
          className={cn(
            'relative flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
            pathname === `/${locale}/agents`
              ? 'bg-violet-500/10 font-medium text-violet-300'
              : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200',
          )}
        >
          {pathname === `/${locale}/agents` && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-violet-400" />
          )}
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-violet-500/20 text-violet-400">
            <Brain size={11} />
          </span>
          <span className="truncate">Planning Agent</span>
        </Link>

        {/* Personal agents */}
        {(agents as any[]).map((agent, i) => (
          <motion.div key={agent.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04, duration: 0.18 }}>
            <Link
              href={`/${locale}/agents`}
              className={cn(
                'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                'text-zinc-400 hover:bg-white/5 hover:text-zinc-200',
              )}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[oklch(0.75_0.15_210/0.15)] text-[oklch(0.75_0.15_210)]">
                <Bot size={11} />
              </span>
              <span className="truncate">{agent.name}</span>
            </Link>
          </motion.div>
        ))}
        <Link
          href={`/${locale}/agents`}
          className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-zinc-500 hover:bg-white/5 hover:text-zinc-300 transition-colors"
        >
          <Plus size={13} />
          New agent
        </Link>
      </SidebarSection>

      {/* Skills */}
      <SidebarSection
        label="Skills"
        open={skillsOpen}
        onToggle={() => setSkillsOpen((o) => !o)}
      >
        {(skills as any[]).map((skill, i) => (
          <motion.div key={skill.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04, duration: 0.18 }}>
            <Link
              href={`/${locale}/skills`}
              className={cn(
                'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                pathname === `/${locale}/skills`
                  ? 'bg-violet-500/10 font-medium text-violet-300'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200',
              )}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-amber-500/20 text-amber-400">
                <Zap size={11} />
              </span>
              <span className="truncate">{skill.name}</span>
            </Link>
          </motion.div>
        ))}
        <Link
          href={`/${locale}/skills`}
          className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-zinc-500 hover:bg-white/5 hover:text-zinc-300 transition-colors"
        >
          <Plus size={13} />
          New skill
        </Link>
      </SidebarSection>

      {/* MCP */}
      <SidebarSection
        label="MCP Servers"
        open={mcpsOpen}
        onToggle={() => setMcpsOpen((o) => !o)}
      >
        {(mcps as any[]).map((mcp, i) => (
          <motion.div key={mcp.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04, duration: 0.18 }}>
            <Link
              href={`/${locale}/mcp`}
              className={cn(
                'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                pathname === `/${locale}/mcp`
                  ? 'bg-violet-500/10 font-medium text-violet-300'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200',
              )}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-indigo-500/20 text-indigo-400">
                <Server size={11} />
              </span>
              <span className="truncate">{mcp.name}</span>
            </Link>
          </motion.div>
        ))}
        <Link
          href={`/${locale}/mcp`}
          className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-zinc-500 hover:bg-white/5 hover:text-zinc-300 transition-colors"
        >
          <Plus size={13} />
          New MCP
        </Link>
      </SidebarSection>

      {/* User */}
      <div className="mt-auto border-t border-[oklch(0.22_0.02_265)] pt-4">
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-white/5 transition-colors"
          >
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" className="h-7 w-7 rounded-full object-cover ring-1 ring-[oklch(0.22_0.02_265)] shrink-0" />
            ) : (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-xs font-semibold text-violet-300">
                {user?.displayName?.[0] ?? user?.email?.[0] ?? '?'}
              </span>
            )}
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-medium text-zinc-200">
                {user?.displayName || user?.email?.split('@')[0] || 'Account'}
              </p>
              <p className="truncate text-xs text-zinc-500">{user?.email}</p>
            </div>
            <Settings size={14} className="shrink-0 text-zinc-500" />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97 }}
                transition={{ duration: 0.12 }}
                className="absolute bottom-full left-0 right-0 mb-1 overflow-hidden rounded-xl border border-[oklch(0.22_0.02_265)] bg-[oklch(0.12_0.014_265)] shadow-xl shadow-black/40"
              >
                <Link
                  href={`/${locale}/settings`}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors"
                >
                  <Settings size={14} className="text-zinc-500" />
                  Settings
                </Link>
                <div className="mx-3 border-t border-[oklch(0.22_0.02_265)]" />
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-zinc-300 hover:bg-white/5 hover:text-red-400 transition-colors"
                >
                  <LogOut size={14} className="text-zinc-500" />
                  Sign out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </aside>
  );
}

function SidebarSection({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
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
            initial="closed"
            animate="open"
            exit="closed"
            variants={sectionVariants}
            className="overflow-hidden"
          >
            <div className="mt-1 flex flex-col gap-0.5">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
