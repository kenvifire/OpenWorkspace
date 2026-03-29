'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { agentsApi, billingApi } from '@/lib/api';
import type { AgentType, PricingModel, LlmProvider } from '@openworkspace/api-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Bot, Plus, Globe, GlobeLock, ShieldCheck, AlertTriangle, Eye, EyeOff,
  TrendingUp, Users, CheckCircle2,
} from 'lucide-react';
import { motion } from 'framer-motion';

const PROVIDERS_LIST = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'custom', label: 'Custom (OpenAI-compatible)' },
];

function AgentForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [tab, setTab] = useState<'basic' | 'llm' | 'advanced'>('basic');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [agentType, setAgentType] = useState<AgentType>('AI');
  const [pricingModel, setPricingModel] = useState<PricingModel>('PER_JOB');
  const [pricePerJob, setPricePerJob] = useState('');
  const [pricePerToken, setPricePerToken] = useState('');
  const [tags, setTags] = useState('');
  const [llmProvider, setLlmProvider] = useState<LlmProvider>('openai');
  const [modelName, setModelName] = useState('gpt-4o');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [temperature, setTemperature] = useState('0.7');
  const [maxTokens, setMaxTokens] = useState('');
  const [maxIterations, setMaxIterations] = useState('20');

  const createAgent = useMutation({
    mutationFn: () => agentsApi.createAgent({
      name, description, type: agentType, pricingModel,
      ...(pricingModel === 'PER_JOB' ? { pricePerJob: Number(pricePerJob) || 0 } : {}),
      ...(pricingModel === 'PER_TOKEN' ? { pricePerToken: Number(pricePerToken) || 0 } : {}),
      capabilityTags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      ...(agentType === 'AI' ? {
        llmProvider, modelName,
        systemPrompt: systemPrompt || undefined,
        apiKey: apiKey || undefined,
        temperature: temperature ? Number(temperature) : undefined,
        maxTokens: maxTokens ? Number(maxTokens) : undefined,
        maxIterations: maxIterations ? Number(maxIterations) : undefined,
      } : {}),
    }),
    onSuccess: () => { onSuccess(); onClose(); },
  });

  const tabs = ['basic', ...(agentType === 'AI' ? ['llm', 'advanced'] : [])] as const;

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3"><CardTitle className="text-base">Create Marketplace Agent</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-1 rounded-lg bg-zinc-100 p-1">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t as typeof tab)}
              className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                tab === t ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {t === 'llm' ? 'LLM Config' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === 'basic' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select value={agentType} onValueChange={(v) => setAgentType((v ?? 'AI') as AgentType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectItem value="AI">AI Agent</SelectItem>
                    <SelectItem value="HUMAN">Human Agent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Pricing model</Label>
                <Select value={pricingModel} onValueChange={(v) => setPricingModel((v ?? 'PER_JOB') as PricingModel)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectItem value="PER_JOB">Per job</SelectItem>
                    <SelectItem value="PER_TOKEN">Per token</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input placeholder="My Agent" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Textarea placeholder="What this agent does…" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {pricingModel === 'PER_JOB' && (
                <div className="space-y-1">
                  <Label className="text-xs">Price per job (cents)</Label>
                  <Input type="number" placeholder="500" value={pricePerJob} onChange={(e) => setPricePerJob(e.target.value)} />
                </div>
              )}
              {pricingModel === 'PER_TOKEN' && (
                <div className="space-y-1">
                  <Label className="text-xs">Price per token (micro-cents)</Label>
                  <Input type="number" placeholder="10" value={pricePerToken} onChange={(e) => setPricePerToken(e.target.value)} />
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Capability tags (comma-separated)</Label>
                <Input placeholder="coding, typescript" value={tags} onChange={(e) => setTags(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {tab === 'llm' && agentType === 'AI' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Provider</Label>
                <Select value={llmProvider} onValueChange={(v) => setLlmProvider((v ?? 'openai') as LlmProvider)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {PROVIDERS_LIST.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Model name</Label>
                <Input placeholder="gpt-4o" value={modelName} onChange={(e) => setModelName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">System prompt</Label>
              <Textarea placeholder="You are a helpful AI agent that specializes in..." rows={5} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">API Key override <span className="text-zinc-400">(optional)</span></Label>
              <div className="relative">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="sk-... (leave blank to use workspace key)"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowApiKey((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700">
                  {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'advanced' && agentType === 'AI' && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Temperature (0–2)</Label>
                <Input type="number" step="0.1" min="0" max="2" placeholder="0.7" value={temperature} onChange={(e) => setTemperature(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max tokens</Label>
                <Input type="number" placeholder="Default" value={maxTokens} onChange={(e) => setMaxTokens(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max iterations</Label>
                <Input type="number" min="1" max="100" placeholder="20" value={maxIterations} onChange={(e) => setMaxIterations(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {createAgent.isError && (
          <p className="text-xs text-red-500">
            {(() => {
              const msg = (createAgent.error as any)?.response?.data?.message;
              if (typeof msg === 'string') return msg;
              if (Array.isArray(msg)) return msg[0];
              return (createAgent.error as Error)?.message ?? 'Failed to create agent';
            })()}
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" disabled={!name || !description || createAgent.isPending} onClick={() => createAgent.mutate()}>
            {createAgent.isPending ? 'Creating…' : 'Create agent'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProvidersPage() {
  const qc = useQueryClient();
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [showAgentForm, setShowAgentForm] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');

  const { data: provider, isLoading } = useQuery({
    queryKey: ['my-provider'],
    queryFn: agentsApi.getMyProvider,
    retry: false,
  });

  const { data: agents = [], isLoading: agentsLoading } = useQuery({
    queryKey: ['my-provider-agents'],
    queryFn: agentsApi.listMyAgents,
    enabled: !!provider,
  });

  const { data: earnings } = useQuery({
    queryKey: ['provider-earnings'],
    queryFn: billingApi.getProviderEarnings,
    enabled: !!provider,
  });

  const registerProvider = useMutation({
    mutationFn: () => agentsApi.registerProvider({ displayName, bio }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-provider'] }); setShowRegisterForm(false); },
  });

  const acceptDpa = useMutation({
    mutationFn: () => agentsApi.acceptDpa('1.0'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-provider'] }),
  });

  const togglePublish = useMutation({
    mutationFn: ({ agentId, isPublished }: { agentId: string; isPublished: boolean }) =>
      isPublished ? agentsApi.unpublishAgent(agentId) : agentsApi.publishAgent(agentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-provider-agents'] }),
  });

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-12 w-48 animate-pulse rounded-xl bg-zinc-200" />
        <div className="h-64 animate-pulse rounded-2xl bg-zinc-200" />
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="min-h-full p-8">
        <h1 className="mb-1 text-2xl font-bold text-zinc-900">Provider Dashboard</h1>
        <p className="mb-8 text-sm text-zinc-500">Publish agents to the marketplace and earn revenue</p>

        {!showRegisterForm ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 bg-white py-24 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600">
              <Bot size={26} className="text-white" />
            </div>
            <p className="font-semibold text-zinc-700">Not registered as a provider</p>
            <p className="mt-1 text-sm text-zinc-400">Register to publish agents and earn from the marketplace.</p>
            <Button className="mt-6" onClick={() => setShowRegisterForm(true)}>
              <Plus size={14} className="mr-1.5" /> Become a provider
            </Button>
          </div>
        ) : (
          <div className="max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/80">
            <h2 className="mb-4 font-semibold text-zinc-900">Register as a provider</h2>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Display name</Label>
                <Input placeholder="Acme AI Labs" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Bio <span className="text-zinc-400">(optional)</span></Label>
                <Textarea placeholder="Tell hirers about your agents…" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowRegisterForm(false)}>Cancel</Button>
                <Button className="flex-1" disabled={!displayName || registerProvider.isPending} onClick={() => registerProvider.mutate()}>
                  {registerProvider.isPending ? 'Registering…' : 'Register'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const hasDpa = !!provider.activeDpaVersion;
  const hasKyc = provider.kycVerified;

  return (
    <div className="min-h-full p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8 flex items-start justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{provider.displayName}</h1>
          <p className="mt-1 text-sm text-zinc-500">Provider dashboard</p>
        </div>
        {earnings && (
          <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white shadow-sm">
            <p className="text-xs font-medium text-emerald-100">This cycle earnings</p>
            <p className="mt-1 text-3xl font-bold">{earnings.totalFormatted}</p>
          </div>
        )}
      </motion.div>

      {/* Compliance */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        <div className={`flex items-center gap-3 rounded-2xl border p-4 ${hasDpa ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${hasDpa ? 'bg-emerald-100' : 'bg-amber-100'}`}>
            <ShieldCheck size={18} className={hasDpa ? 'text-emerald-600' : 'text-amber-600'} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-zinc-800">Data Processing Agreement</p>
            <p className="text-xs text-zinc-500">{hasDpa ? `Accepted v${provider.activeDpaVersion}` : 'Not accepted — required to publish'}</p>
          </div>
          {hasDpa ? (
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
          ) : (
            <Button size="sm" onClick={() => acceptDpa.mutate()} disabled={acceptDpa.isPending}>
              Accept DPA
            </Button>
          )}
        </div>
        <div className={`flex items-center gap-3 rounded-2xl border p-4 ${hasKyc ? 'border-emerald-200 bg-emerald-50' : 'border-zinc-200 bg-white'}`}>
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${hasKyc ? 'bg-emerald-100' : 'bg-zinc-100'}`}>
            <AlertTriangle size={18} className={hasKyc ? 'text-emerald-600' : 'text-zinc-400'} />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-800">Identity Verification (KYC)</p>
            <p className="text-xs text-zinc-500">{hasKyc ? 'Verified' : 'Pending — contact support to verify'}</p>
          </div>
          {hasKyc && <CheckCircle2 size={16} className="text-emerald-500 shrink-0 ml-auto" />}
        </div>
      </motion.div>

      {/* Agents */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-zinc-900">Marketplace Agents</h2>
          <Button size="sm" variant="outline" onClick={() => setShowAgentForm((v) => !v)} className="bg-white">
            <Plus size={13} className="mr-1.5" /> New agent
          </Button>
        </div>

        {showAgentForm && (
          <AgentForm
            onClose={() => setShowAgentForm(false)}
            onSuccess={() => qc.invalidateQueries({ queryKey: ['my-provider-agents'] })}
          />
        )}

        {agentsLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-zinc-200" />)}
          </div>
        ) : agents.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-white py-12 text-center text-sm text-zinc-400">
            No marketplace agents yet
          </div>
        ) : (
          <div className="space-y-3">
            {agents.map((agent, i) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.2 }}
                className="group flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200/80"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white">
                  <Bot size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-zinc-900">{agent.name}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500">{agent.type}</span>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500">{agent.pricingModel.replace('_', ' ')}</span>
                    <span className="flex items-center gap-1 text-xs text-zinc-400">
                      <Users size={11} />
                      {agent._count?.projectAgents ?? 0} hires
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={agent.isPublished ? 'outline' : 'default'}
                  disabled={!hasDpa || !hasKyc || togglePublish.isPending}
                  onClick={() => togglePublish.mutate({ agentId: agent.id, isPublished: agent.isPublished })}
                >
                  {agent.isPublished
                    ? <><GlobeLock size={13} className="mr-1.5" /> Unpublish</>
                    : <><Globe size={13} className="mr-1.5" /> Publish</>}
                </Button>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
