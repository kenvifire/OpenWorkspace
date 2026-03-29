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
import { useState } from 'react';
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
    { label: t('settings'), href: `/${locale}/providers`, icon: <Settings size={15} /> },
  ];

  const handleSignOut = async () => {
    await signOut();
    router.push(`/${locale}/sign-in`);
  };

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-zinc-200 bg-white px-3 py-4 overflow-y-auto shrink-0">
      {/* Brand */}
      <div className="mb-5 px-2 pt-1 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600">
          <span className="text-xs font-bold text-white">OW</span>
        </div>
        <span className="text-sm font-bold tracking-tight text-zinc-900">OpenWorkspace</span>
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
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-violet-50 text-violet-700'
                    : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900',
                )}
              >
                <span className={active ? 'text-violet-600' : ''}>{item.icon}</span>
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
                'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                pathname.includes(`/workspaces/${ws.slug}`)
                  ? 'bg-violet-50 font-medium text-violet-700'
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900',
              )}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-violet-100 text-[10px] font-bold uppercase text-violet-600">
                {ws.name[0]}
              </span>
              <span className="truncate">{ws.name}</span>
            </Link>
          </motion.div>
        ))}
        <Link
          href={`/${locale}/workspaces/new`}
          className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
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
            'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
            pathname === `/${locale}/agents`
              ? 'bg-violet-50 font-medium text-violet-700'
              : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900',
          )}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-violet-100 text-violet-500">
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
                pathname === `/${locale}/agents`
                  ? 'bg-sky-50 font-medium text-sky-700'
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900',
              )}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-sky-100 text-sky-500">
                <Bot size={11} />
              </span>
              <span className="truncate">{agent.name}</span>
            </Link>
          </motion.div>
        ))}
        <Link
          href={`/${locale}/agents`}
          className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
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
                  ? 'bg-amber-50 font-medium text-amber-700'
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900',
              )}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-amber-100 text-amber-500">
                <Zap size={11} />
              </span>
              <span className="truncate">{skill.name}</span>
            </Link>
          </motion.div>
        ))}
        <Link
          href={`/${locale}/skills`}
          className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
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
                  ? 'bg-indigo-50 font-medium text-indigo-700'
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900',
              )}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-indigo-100 text-indigo-500">
                <Server size={11} />
              </span>
              <span className="truncate">{mcp.name}</span>
            </Link>
          </motion.div>
        ))}
        <Link
          href={`/${locale}/mcp`}
          className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
        >
          <Plus size={13} />
          New MCP
        </Link>
      </SidebarSection>

      {/* User */}
      <div className="mt-auto border-t border-zinc-100 pt-4">
        <div className="flex items-center gap-2.5 px-2">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" className="h-7 w-7 rounded-full object-cover ring-1 ring-zinc-200" />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700">
              {user?.displayName?.[0] ?? user?.email?.[0] ?? '?'}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-800">
              {user?.displayName || user?.email?.split('@')[0] || 'Account'}
            </p>
            <p className="truncate text-xs text-zinc-400">{user?.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="ml-auto shrink-0 rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
            title="Sign out"
          >
            <LogOut size={14} />
          </button>
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
        className="flex w-full items-center justify-between px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 hover:text-zinc-600 transition-colors"
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
