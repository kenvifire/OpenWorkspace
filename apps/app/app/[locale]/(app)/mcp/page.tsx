'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mcpsApi, myAgentsApi } from '@/lib/api';
import type { Mcp, CreateMcpDto, UpdateMcpDto } from '@/lib/api';
import type { Agent } from '@openworkspace/api-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Server, Plus, Pencil, Trash2, Bot, X, Check, Globe, Terminal, Wifi, Search, Download,
  Database, FileText, Github, Chrome, Brain, Clock, FolderOpen, GitBranch, Cpu, Shield,
} from 'lucide-react';
import { motion } from 'framer-motion';

// ─── MCP Hub catalogue ────────────────────────────────────────────────────────

type HubMcp = {
  key: string;
  name: string;
  description: string;
  category: string;
  icon: React.ReactNode;
  gradient: string;
  preset: Partial<CreateMcpDto>;
};

const MCP_HUB: HubMcp[] = [
  // Official MCP servers
  {
    key: 'filesystem',
    name: 'Filesystem',
    description: 'Read, write, and search files on the local filesystem with configurable allowed paths.',
    category: 'Official',
    icon: <FolderOpen size={18} />,
    gradient: 'from-amber-500 to-orange-600',
    preset: {
      name: 'filesystem',
      description: 'Access local files and directories — read, write, list, search.',
      transport: 'STDIO',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/allowed/dir'],
    },
  },
  {
    key: 'git',
    name: 'Git',
    description: 'Read Git repository history, diffs, branches, and commits.',
    category: 'Official',
    icon: <GitBranch size={18} />,
    gradient: 'from-orange-500 to-red-500',
    preset: {
      name: 'git',
      description: 'Interact with Git repositories — log, diff, blame, show.',
      transport: 'STDIO',
      command: 'uvx',
      args: ['mcp-server-git', '--repository', '/path/to/repo'],
    },
  },
  {
    key: 'github-mcp',
    name: 'GitHub',
    description: 'Full GitHub integration — repos, issues, PRs, code search via official MCP server.',
    category: 'Official',
    icon: <Github size={18} />,
    gradient: 'from-zinc-800 to-zinc-600',
    preset: {
      name: 'github',
      description: 'GitHub repos, issues, pull requests, code search, and actions.',
      transport: 'STDIO',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
    },
  },
  {
    key: 'postgres',
    name: 'PostgreSQL',
    description: 'Read-only access to PostgreSQL databases — query, inspect schema, and explore data.',
    category: 'Official',
    icon: <Database size={18} />,
    gradient: 'from-blue-600 to-blue-800',
    preset: {
      name: 'postgres',
      description: 'Read-only PostgreSQL access — query data, inspect schema.',
      transport: 'STDIO',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://user:password@localhost/dbname'],
    },
  },
  {
    key: 'sqlite',
    name: 'SQLite',
    description: 'Read and write SQLite databases with full SQL query support.',
    category: 'Official',
    icon: <Database size={18} />,
    gradient: 'from-indigo-500 to-blue-600',
    preset: {
      name: 'sqlite',
      description: 'SQLite database access — read, write, and schema inspection.',
      transport: 'STDIO',
      command: 'uvx',
      args: ['mcp-server-sqlite', '--db-path', '/path/to/database.db'],
    },
  },
  {
    key: 'fetch',
    name: 'Fetch',
    description: 'Fetch URLs and convert web pages to Markdown for easy reading by the agent.',
    category: 'Official',
    icon: <Globe size={18} />,
    gradient: 'from-sky-500 to-blue-600',
    preset: {
      name: 'fetch',
      description: 'Fetch web pages and convert to Markdown.',
      transport: 'STDIO',
      command: 'uvx',
      args: ['mcp-server-fetch'],
    },
  },
  {
    key: 'memory',
    name: 'Memory',
    description: 'Persistent key-value memory store — agents can store and recall facts across sessions.',
    category: 'Official',
    icon: <Brain size={18} />,
    gradient: 'from-violet-500 to-purple-600',
    preset: {
      name: 'memory',
      description: 'Persistent agent memory — store and recall structured information.',
      transport: 'STDIO',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-memory'],
    },
  },
  {
    key: 'sequential-thinking',
    name: 'Sequential Thinking',
    description: 'Structured multi-step reasoning — helps agents think through complex problems step by step.',
    category: 'Official',
    icon: <Cpu size={18} />,
    gradient: 'from-teal-500 to-emerald-600',
    preset: {
      name: 'sequential_thinking',
      description: 'Break complex problems into clear reasoning steps.',
      transport: 'STDIO',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
    },
  },
  // Community
  {
    key: 'brave-search',
    name: 'Brave Search',
    description: 'Real-time web search via Brave Search API with privacy-focused results.',
    category: 'Search',
    icon: <Search size={18} />,
    gradient: 'from-orange-400 to-red-500',
    preset: {
      name: 'brave_search',
      description: 'Web and local search via Brave Search API.',
      transport: 'STDIO',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-brave-search'],
    },
  },
  {
    key: 'puppeteer',
    name: 'Puppeteer',
    description: 'Control a headless Chrome browser — navigate, click, screenshot, and scrape pages.',
    category: 'Browser',
    icon: <Chrome size={18} />,
    gradient: 'from-yellow-500 to-amber-600',
    preset: {
      name: 'puppeteer',
      description: 'Headless Chrome automation — navigate, interact, screenshot.',
      transport: 'STDIO',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-puppeteer'],
    },
  },
  {
    key: 'time',
    name: 'Time',
    description: 'Get current time and convert between timezones.',
    category: 'Utilities',
    icon: <Clock size={18} />,
    gradient: 'from-cyan-500 to-teal-600',
    preset: {
      name: 'time',
      description: 'Current time queries and timezone conversions.',
      transport: 'STDIO',
      command: 'uvx',
      args: ['mcp-server-time'],
    },
  },
  {
    key: 'everything',
    name: 'Everything',
    description: 'Reference MCP server that demonstrates all MCP capabilities — useful for testing.',
    category: 'Utilities',
    icon: <Server size={18} />,
    gradient: 'from-zinc-500 to-zinc-700',
    preset: {
      name: 'everything',
      description: 'Full-featured reference MCP server for testing and exploration.',
      transport: 'STDIO',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-everything'],
    },
  },
  {
    key: 'aws-kb',
    name: 'AWS Knowledge Base',
    description: 'Query Amazon Bedrock Knowledge Bases for RAG-powered document retrieval.',
    category: 'Cloud',
    icon: <FileText size={18} />,
    gradient: 'from-yellow-600 to-orange-600',
    preset: {
      name: 'aws_kb_retrieval',
      description: 'Retrieve documents from Amazon Bedrock Knowledge Base.',
      transport: 'STDIO',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-aws-kb-retrieval'],
    },
  },
  {
    key: 'sentry',
    name: 'Sentry',
    description: 'Query Sentry issues, events, and error traces for debugging.',
    category: 'Developer Tools',
    icon: <Shield size={18} />,
    gradient: 'from-indigo-600 to-violet-700',
    preset: {
      name: 'sentry',
      description: 'Query Sentry error tracking — issues, events, and stack traces.',
      transport: 'STDIO',
      command: 'uvx',
      args: ['mcp-server-sentry', '--auth-token', 'YOUR_SENTRY_TOKEN'],
    },
  },
];

const MCP_CATEGORIES = ['All', ...Array.from(new Set(MCP_HUB.map((m) => m.category)))];

// ─── MCP Form ─────────────────────────────────────────────────────────────────

function McpForm({ initial, preset, onClose, onSuccess }: {
  initial?: Mcp;
  preset?: Partial<CreateMcpDto>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(initial?.name ?? preset?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? preset?.description ?? '');
  const [transport, setTransport] = useState<'SSE' | 'HTTP' | 'STDIO'>(initial?.transport ?? preset?.transport ?? 'SSE');
  const [url, setUrl] = useState(initial?.url ?? (preset as any)?.url ?? '');
  const [command, setCommand] = useState(initial?.command ?? (preset as any)?.command ?? '');
  const [args, setArgs] = useState(((initial?.args ?? (preset as any)?.args ?? []) as string[]).join(', '));
  const [headers, setHeaders] = useState(initial?.headers ?? (preset as any)?.headers ?? '');

  const buildDto = (): CreateMcpDto | UpdateMcpDto => ({
    name, description, transport,
    ...(transport !== 'STDIO' ? { url: url || undefined, headers: headers || undefined } : {}),
    ...(transport === 'STDIO' ? { command: command || undefined, args: args ? args.split(',').map((a) => a.trim()).filter(Boolean) : [] } : {}),
  });

  const createMutation = useMutation({
    mutationFn: () => mcpsApi.create(buildDto() as CreateMcpDto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-mcps'] }); onSuccess(); onClose(); },
  });
  const updateMutation = useMutation({
    mutationFn: () => mcpsApi.update(initial!.id, buildDto()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-mcps'] }); onSuccess(); onClose(); },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  const error = createMutation.error || updateMutation.error;

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (initial) updateMutation.mutate(); else createMutation.mutate(); }} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-zinc-300 text-xs font-medium uppercase tracking-wide">Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="filesystem"
            required
            minLength={2}
            maxLength={80}
            className="bg-[#0f0f1a] border-[#1e1e3a] text-white placeholder:text-zinc-600 focus:border-violet-500/50 font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-zinc-300 text-xs font-medium uppercase tracking-wide">Transport</Label>
          <Select value={transport} onValueChange={(v) => setTransport((v ?? 'SSE') as 'SSE' | 'HTTP' | 'STDIO')}>
            <SelectTrigger className="w-full bg-[#0f0f1a] border-[#1e1e3a] text-white focus:border-violet-500/50"><SelectValue /></SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectItem value="SSE">SSE (Server-Sent Events)</SelectItem>
              <SelectItem value="HTTP">HTTP (Streamable)</SelectItem>
              <SelectItem value="STDIO">STDIO (Local process)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-zinc-300 text-xs font-medium uppercase tracking-wide">Description</Label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What tools does this MCP server provide?"
          required
          minLength={5}
          maxLength={500}
          className="bg-[#0f0f1a] border-[#1e1e3a] text-white placeholder:text-zinc-600 focus:border-violet-500/50"
        />
      </div>

      {transport !== 'STDIO' && (
        <div className="space-y-3 rounded-xl border border-[#1e1e3a] bg-white/[0.03] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-400">Connection</p>
          <div className="space-y-1.5">
            <Label className="text-zinc-300 text-xs font-medium uppercase tracking-wide">Server URL</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={transport === 'SSE' ? 'https://mcp.example.com/sse' : 'https://mcp.example.com/mcp'}
              type="url"
              required
              className="bg-[#0f0f1a] border-[#1e1e3a] text-white placeholder:text-zinc-600 focus:border-violet-500/50 font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-300 text-xs font-medium uppercase tracking-wide">Headers <span className="text-zinc-600 normal-case">(JSON)</span></Label>
            <Input
              value={headers}
              onChange={(e) => setHeaders(e.target.value)}
              placeholder='{"Authorization": "Bearer sk-..."}'
              className="font-mono text-sm bg-[#0f0f1a] border-[#1e1e3a] text-white placeholder:text-zinc-600 focus:border-violet-500/50"
            />
          </div>
        </div>
      )}

      {transport === 'STDIO' && (
        <div className="space-y-3 rounded-xl border border-[#1e1e3a] bg-white/[0.03] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-400">Process Config</p>
          <div className="space-y-1.5">
            <Label className="text-zinc-300 text-xs font-medium uppercase tracking-wide">Command</Label>
            <Input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="npx"
              required
              className="font-mono text-sm bg-[#0f0f1a] border-[#1e1e3a] text-white placeholder:text-zinc-600 focus:border-violet-500/50"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-300 text-xs font-medium uppercase tracking-wide">Arguments <span className="text-zinc-600 normal-case">(comma-separated)</span></Label>
            <Input
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              placeholder="-y, @modelcontextprotocol/server-filesystem, /path/to/dir"
              className="font-mono text-sm bg-[#0f0f1a] border-[#1e1e3a] text-white placeholder:text-zinc-600 focus:border-violet-500/50"
            />
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-400 font-mono">{(error as any)?.response?.data?.message ?? 'Something went wrong'}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 transition-all duration-200"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Saving…' : initial ? 'Save changes' : 'Create MCP'}
        </button>
      </div>
    </form>
  );
}

// ─── Assign Agents Panel ──────────────────────────────────────────────────────

function AssignAgentsPanel({ mcp }: { mcp: Mcp }) {
  const qc = useQueryClient();
  const { data: agents = [] } = useQuery<Agent[]>({ queryKey: ['my-agents'], queryFn: myAgentsApi.list });
  const { data: agentMcps = [] } = useQuery<any[]>({
    queryKey: ['mcp-agents', mcp.id],
    queryFn: async () => {
      const results = await Promise.all(agents.map((a) => myAgentsApi.listMcps(a.id)));
      return agents.map((a, i) => ({ agent: a, assigned: results[i].some((am: any) => am.mcpId === mcp.id) }));
    },
    enabled: agents.length > 0,
  });

  const assign = useMutation({
    mutationFn: (agentId: string) => myAgentsApi.assignMcp(agentId, mcp.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mcp-agents', mcp.id] }); qc.invalidateQueries({ queryKey: ['my-mcps'] }); },
  });
  const remove = useMutation({
    mutationFn: (agentId: string) => myAgentsApi.removeMcp(agentId, mcp.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mcp-agents', mcp.id] }); qc.invalidateQueries({ queryKey: ['my-mcps'] }); },
  });

  if (agents.length === 0) return <p className="text-sm text-zinc-500">No personal agents yet.</p>;

  return (
    <div className="space-y-2">
      {agentMcps.map(({ agent, assigned }: { agent: Agent; assigned: boolean }) => (
        <div key={agent.id} className="flex items-center justify-between rounded-xl border border-[#1e1e3a] bg-white/[0.03] px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500">
              <Bot size={11} className="text-white" />
            </div>
            <span className="text-sm font-medium text-zinc-200">{agent.name}</span>
            {agent.modelName && (
              <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-mono bg-violet-500/10 text-violet-400 border border-violet-500/20">
                {agent.modelName}
              </span>
            )}
          </div>
          <button
            onClick={() => assigned ? remove.mutate(agent.id) : assign.mutate(agent.id)}
            disabled={assign.isPending || remove.isPending}
            className={`h-7 px-3 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1 disabled:opacity-50 ${
              assigned
                ? 'bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 text-zinc-400 hover:text-red-400'
                : 'bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300'
            }`}
          >
            {assigned ? <><X size={11} />Remove</> : <><Check size={11} />Assign</>}
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── MCP Card ─────────────────────────────────────────────────────────────────

const TRANSPORT_META = {
  SSE: { label: 'SSE', icon: Wifi, color: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20', gradient: 'from-indigo-500 to-violet-600' },
  HTTP: { label: 'HTTP', icon: Globe, color: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20', gradient: 'from-sky-500 to-blue-600' },
  STDIO: { label: 'STDIO', icon: Terminal, color: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20', gradient: 'from-emerald-500 to-teal-600' },
};

function McpCard({ mcp }: { mcp: Mcp }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [showAgents, setShowAgents] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => mcpsApi.delete(mcp.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-mcps'] }),
  });

  const meta = TRANSPORT_META[mcp.transport] ?? TRANSPORT_META.SSE;
  const TransportIcon = meta.icon;

  if (editing) {
    return (
      <div className="rounded-2xl bg-[#0f0f1a] border border-[#1e1e3a] p-5">
        <h3 className="text-base font-semibold text-white mb-4">Edit MCP</h3>
        <McpForm initial={mcp} onClose={() => setEditing(false)} onSuccess={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className="group relative overflow-hidden rounded-2xl bg-[#0f0f1a] border border-[#1e1e3a] hover:border-violet-500/30 p-5 transition-all duration-300 hover:shadow-[0_0_30px_rgba(139,92,246,0.15)]"
    >
      <div className="absolute right-0 top-0 h-32 w-32 -translate-y-10 translate-x-10 rounded-full bg-cyan-500/5 blur-2xl group-hover:bg-cyan-500/10 transition-opacity" />
      <div className="flex items-start gap-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${meta.gradient} shadow-sm text-white`}>
          <TransportIcon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-white">{mcp.name}</h3>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.color}`}>
              <TransportIcon size={10} />{meta.label}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-zinc-400 line-clamp-1">{mcp.description}</p>
          {(mcp.url || mcp.command) && (
            <p className="mt-1 font-mono text-xs text-zinc-600 truncate">
              {mcp.url ?? `${mcp.command} ${(mcp.args ?? []).join(' ')}`}
            </p>
          )}
          <p className="mt-1.5 text-xs text-zinc-600">Assigned to <span className="font-medium text-zinc-400">{mcp._count?.agents ?? 0}</span> agent{(mcp._count?.agents ?? 0) !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => setShowAgents((v) => !v)}
            className={`h-8 px-3 rounded-lg text-xs font-medium transition-all duration-200 border ${
              showAgents
                ? 'bg-violet-600/20 text-violet-300 border-violet-500/30'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-zinc-400 hover:text-zinc-300'
            }`}
          >
            {showAgents ? 'Hide agents' : 'Assign agents'}
          </button>
          <button
            onClick={() => setEditing(true)}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all duration-200"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => { if (confirm(`Delete "${mcp.name}"?`)) deleteMutation.mutate(); }}
            disabled={deleteMutation.isPending}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 disabled:opacity-50"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      {showAgents && (
        <div className="mt-4 border-t border-[#1e1e3a] pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Agents</p>
          <AssignAgentsPanel mcp={mcp} />
        </div>
      )}
    </motion.div>
  );
}

// ─── Hub Card ─────────────────────────────────────────────────────────────────

function HubMcpCard({ item, installed, onInstall, installing }: {
  item: HubMcp;
  installed: boolean;
  onInstall: () => void;
  installing: boolean;
}) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className="group relative overflow-hidden rounded-2xl bg-[#0f0f1a] border border-[#1e1e3a] hover:border-violet-500/30 p-5 transition-all duration-300 hover:shadow-[0_0_30px_rgba(139,92,246,0.15)]"
    >
      <div className="flex items-start gap-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${item.gradient} shadow-sm text-white`}>
          {item.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-white">{item.name}</h3>
            <span className="rounded-full bg-white/[0.04] border border-white/[0.08] px-2 py-0.5 text-[11px] font-medium text-zinc-500">{item.category}</span>
            <span className="rounded-full bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 text-[11px] font-medium text-cyan-400 font-mono">{(item.preset.transport ?? 'STDIO')}</span>
          </div>
          <p className="mt-0.5 text-sm text-zinc-400">{item.description}</p>
          {(item.preset as any).command && (
            <p className="mt-1 font-mono text-xs text-zinc-600 truncate">
              {(item.preset as any).command} {((item.preset as any).args ?? []).join(' ')}
            </p>
          )}
          {(item.preset as any).url && (
            <p className="mt-1 font-mono text-xs text-zinc-600 truncate">{(item.preset as any).url}</p>
          )}
        </div>
        <button
          disabled={installed || installing}
          onClick={onInstall}
          className={`shrink-0 h-8 px-3 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1 border disabled:cursor-not-allowed ${
            installed
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 cursor-default'
              : installing
                ? 'bg-white/5 text-zinc-500 border-white/10 opacity-60'
                : 'bg-violet-600 hover:bg-violet-500 text-white border-transparent'
          }`}
        >
          {installed ? <><Check size={11} />Installed</> : installing ? 'Installing…' : <><Download size={11} />Install</>}
        </button>
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function McpPage() {
  const qc = useQueryClient();
  const [pageTab, setPageTab] = useState<'mine' | 'hub'>('mine');
  const [creating, setCreating] = useState(false);
  const [hubSearch, setHubSearch] = useState('');
  const [hubCategory, setHubCategory] = useState('All');
  const [installing, setInstalling] = useState<string | null>(null);

  const { data: mcps = [], isLoading } = useQuery({
    queryKey: ['my-mcps'],
    queryFn: mcpsApi.list,
  });

  const installMutation = useMutation({
    mutationFn: (preset: Partial<CreateMcpDto>) => mcpsApi.create(preset as CreateMcpDto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-mcps'] }),
    onSettled: () => setInstalling(null),
  });

  const installedNames = new Set(mcps.map((m) => m.name));

  const filteredHub = MCP_HUB.filter((item) => {
    const matchesCategory = hubCategory === 'All' || item.category === hubCategory;
    const q = hubSearch.toLowerCase();
    const matchesSearch = !q || item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-full p-8 bg-[#080810] bg-[linear-gradient(rgba(255,255,255,.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.015)_1px,transparent_1px)] bg-[size:64px_64px]">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6 flex items-end justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">MCP Servers</h1>
          <p className="mt-1 text-sm text-zinc-500">Connect Model Context Protocol servers to extend your agents with external tools.</p>
        </div>
        {pageTab === 'mine' && !creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white transition-all duration-200"
          >
            <Plus size={14} />New MCP
          </button>
        )}
      </motion.div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl bg-[#0f0f1a] border border-[#1e1e3a] p-1 w-fit">
        {(['mine', 'hub'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setPageTab(t); setCreating(false); }}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
              pageTab === t
                ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t === 'mine' ? (
              `My MCP Servers (${mcps.length})`
            ) : (
              <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent font-semibold">
                ✦ MCP Hub
              </span>
            )}
          </button>
        ))}
      </div>

      {/* My MCPs tab */}
      {pageTab === 'mine' && (
        <>
          {creating && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
              <div className="rounded-2xl bg-[#0f0f1a] border border-[#1e1e3a] p-5">
                <h3 className="text-base font-semibold text-white mb-4">Create MCP Server</h3>
                <McpForm onClose={() => setCreating(false)} onSuccess={() => setCreating(false)} />
              </div>
            </motion.div>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse bg-white/5 rounded-2xl" />)}
            </div>
          ) : mcps.length === 0 && !creating ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#1e1e3a] bg-white/[0.02] py-24 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500">
                <Server size={26} className="text-white" />
              </div>
              <p className="font-semibold text-zinc-300">No MCP servers yet</p>
              <p className="mt-1 text-sm text-zinc-500 max-w-sm">Connect MCP servers to give your agents access to files, databases, APIs, and more.</p>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setCreating(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white transition-all duration-200"
                >
                  <Plus size={14} />New MCP
                </button>
                <button
                  onClick={() => setPageTab('hub')}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 transition-all duration-200"
                >
                  Browse hub
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {mcps.map((mcp, i) => (
                <motion.div key={mcp.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.25 }}>
                  <McpCard mcp={mcp} />
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Hub tab */}
      {pageTab === 'hub' && (
        <div>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
              <Input
                value={hubSearch}
                onChange={(e) => setHubSearch(e.target.value)}
                placeholder="Search MCP servers…"
                className="pl-9 bg-[#0f0f1a] border-[#1e1e3a] text-white placeholder:text-zinc-600 focus:border-violet-500/50"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {MCP_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setHubCategory(cat)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 border ${
                    hubCategory === cat
                      ? 'bg-violet-500/20 text-violet-300 border-violet-500/30'
                      : 'bg-white/[0.03] text-zinc-500 border-white/[0.06] hover:border-white/20 hover:text-zinc-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {filteredHub.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-500">No MCP servers match your search.</p>
          ) : (
            <div className="space-y-3">
              {filteredHub.map((item, i) => (
                <motion.div key={item.key} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, duration: 0.2 }}>
                  <HubMcpCard
                    item={item}
                    installed={installedNames.has(item.preset.name ?? '')}
                    installing={installing === item.key}
                    onInstall={() => { setInstalling(item.key); installMutation.mutate(item.preset); }}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
