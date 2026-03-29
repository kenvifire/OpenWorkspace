'use client';

import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { workspacesApi, workspaceKeysApi } from '@/lib/api';
import type { WorkspaceProviderKey, LlmProvider } from '@openworkspace/api-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Trash2, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI', color: 'bg-green-100 text-green-700' },
  { value: 'anthropic', label: 'Anthropic', color: 'bg-orange-100 text-orange-700' },
  { value: 'gemini', label: 'Google Gemini', color: 'bg-blue-100 text-blue-700' },
  { value: 'custom', label: 'Custom', color: 'bg-zinc-100 text-zinc-600' },
];

export default function WorkspaceSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const locale = useLocale();
  const qc = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [provider, setProvider] = useState<LlmProvider>('openai');
  const [apiKey, setApiKey] = useState('');
  const [label, setLabel] = useState('');
  const [showKey, setShowKey] = useState(false);

  const { data: workspace } = useQuery({
    queryKey: ['workspace', slug],
    queryFn: () => workspacesApi.get(slug),
  });

  const { data: providerKeys = [], isLoading } = useQuery<WorkspaceProviderKey[]>({
    queryKey: ['workspace-provider-keys', workspace?.id],
    queryFn: () => workspaceKeysApi.list(workspace!.id),
    enabled: !!workspace?.id,
  });

  const upsertKey = useMutation({
    mutationFn: () => workspaceKeysApi.upsert(workspace!.id, { provider, apiKey, label: label || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspace-provider-keys', workspace?.id] });
      setShowForm(false);
      setApiKey('');
      setLabel('');
      setProvider('openai');
    },
  });

  const deleteKey = useMutation({
    mutationFn: (p: string) => workspaceKeysApi.delete(workspace!.id, p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspace-provider-keys', workspace?.id] }),
  });

  const providerMeta = (p: string) => PROVIDERS.find((pr) => pr.value === p) ?? { label: p, color: 'bg-zinc-100 text-zinc-600' };

  return (
    <div className="min-h-full p-8">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8"
      >
        <Link
          href={`/${locale}/workspaces/${slug}`}
          className="mb-4 flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 transition-colors"
        >
          <ArrowLeft size={14} /> Back to workspace
        </Link>
        <h1 className="text-2xl font-bold text-zinc-900">{workspace?.name ?? '…'} — Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">Manage LLM provider keys and workspace configuration</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="max-w-2xl"
      >
        {/* Section header */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100">
              <KeyRound size={16} className="text-violet-600" />
            </div>
            <div>
              <h2 className="font-semibold text-zinc-900">LLM Provider API Keys</h2>
              <p className="text-xs text-zinc-400">Shared keys for all agents in this workspace</p>
            </div>
          </div>
          <Button size="sm" onClick={() => setShowForm(true)} disabled={showForm}>
            <Plus size={13} className="mr-1.5" /> Add key
          </Button>
        </div>

        {/* Form */}
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/80 space-y-4"
          >
            <h3 className="font-medium text-zinc-900">Add Provider API Key</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Provider</Label>
                <Select value={provider} onValueChange={(v) => setProvider((v ?? 'openai') as LlmProvider)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {PROVIDERS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Label <span className="text-zinc-400">(optional)</span></Label>
                <Input placeholder="e.g. Production" value={label} onChange={(e) => setLabel(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">API Key</Label>
              <div className="relative">
                <Input
                  type={showKey ? 'text' : 'password'}
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pr-10 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                >
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            {upsertKey.isError && (
              <p className="text-xs text-red-500">{(upsertKey.error as any)?.response?.data?.message ?? 'Failed to save key'}</p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setShowForm(false); setApiKey(''); setLabel(''); }}>Cancel</Button>
              <Button className="flex-1" disabled={!apiKey || upsertKey.isPending} onClick={() => upsertKey.mutate()}>
                {upsertKey.isPending ? 'Saving…' : 'Save key'}
              </Button>
            </div>
          </motion.div>
        )}

        {/* Key list */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-zinc-200" />)}
          </div>
        ) : providerKeys.length === 0 && !showForm ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 bg-white py-16 text-center">
            <ShieldCheck size={28} className="mb-3 text-zinc-300" />
            <p className="text-sm font-medium text-zinc-500">No provider keys configured</p>
            <p className="mt-1 text-xs text-zinc-400">Add API keys to allow agents to use LLM providers.</p>
            <Button size="sm" className="mt-4" onClick={() => setShowForm(true)}>
              <Plus size={13} className="mr-1.5" /> Add first key
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {providerKeys.map((k, i) => {
              const meta = providerMeta(k.provider);
              return (
                <motion.div
                  key={k.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.2 }}
                  className="flex items-center gap-4 rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-zinc-200/80"
                >
                  <KeyRound size={15} className="shrink-0 text-zinc-400" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.color}`}>{meta.label}</span>
                      {k.label && <Badge variant="secondary" className="text-[10px]">{k.label}</Badge>}
                    </div>
                    <p className="mt-0.5 font-mono text-xs tracking-widest text-zinc-300">••••••••••••••••</p>
                  </div>
                  <span className="shrink-0 text-xs text-zinc-300">
                    Updated {new Date(k.updatedAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => deleteKey.mutate(k.provider)}
                    disabled={deleteKey.isPending}
                    className="shrink-0 rounded-lg p-1.5 text-zinc-300 hover:bg-red-50 hover:text-red-400 transition-colors"
                    title="Remove key"
                  >
                    <Trash2 size={13} />
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
