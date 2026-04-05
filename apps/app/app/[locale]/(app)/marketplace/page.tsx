'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { marketplaceApi } from '@/lib/api';
import type { MarketplaceSearchParams, Agent } from '@openworkspace/api-types';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, Star, Bot, User, ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

const AGENT_GRADIENTS = [
  'from-violet-500 to-purple-600',
  'from-sky-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-600',
  'from-pink-500 to-rose-600',
  'from-indigo-500 to-violet-600',
];

export default function MarketplacePage() {
  const locale = useLocale();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('ALL');
  const [pricing, setPricing] = useState('ALL');
  const [page, setPage] = useState(1);

  const params: MarketplaceSearchParams = {
    ...(search && { q: search }),
    ...(type !== 'ALL' && { type: type as 'AI' | 'HUMAN' }),
    ...(pricing !== 'ALL' && { pricingModel: pricing as 'PER_JOB' | 'PER_TOKEN' }),
    page,
    limit: 12,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace', params],
    queryFn: () => marketplaceApi.search(params),
    placeholderData: (prev) => prev,
  });

  const agents: Agent[] = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="min-h-full p-8">
      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-10"
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="flex items-center gap-1.5 rounded-full bg-violet-500/20 border border-violet-500/30 px-3 py-1 text-[11px] font-semibold text-violet-300">
            <Sparkles size={10} /> Live Marketplace
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 text-white" style={{ fontFamily: 'var(--font-syne), system-ui, sans-serif' }}>
          Find the right{' '}
          <span className="text-[oklch(0.75_0.15_210)]">agent</span>
        </h1>
        <p className="text-[oklch(0.55_0.02_265)] text-base">Browse AI and human agents to hire for your projects</p>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="mb-7 flex flex-wrap gap-3 items-center"
      >
        <div className="relative flex-1 min-w-52">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[oklch(0.55_0.02_265)]" />
          <Input
            placeholder="Search agents…"
            className="pl-9 bg-[oklch(0.12_0.014_265)] border-[oklch(0.22_0.02_265)] text-zinc-200 placeholder:text-[oklch(0.55_0.02_265)]"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        {/* Pill-style type filters */}
        <div className="flex items-center gap-1.5 rounded-xl border border-[oklch(0.22_0.02_265)] bg-[oklch(0.12_0.014_265)] p-1">
          {['ALL', 'AI', 'HUMAN'].map((t) => (
            <button
              key={t}
              onClick={() => { setType(t); setPage(1); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                type === t
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                  : 'text-[oklch(0.55_0.02_265)] hover:text-zinc-300 hover:bg-white/5'
              }`}
            >
              {t === 'ALL' ? 'All Types' : t === 'AI' ? 'AI Agents' : 'Human Agents'}
            </button>
          ))}
        </div>

        <Select value={pricing} onValueChange={(v) => { setPricing(v ?? 'ALL'); setPage(1); }}>
          <SelectTrigger className="w-40 bg-[oklch(0.12_0.014_265)] border-[oklch(0.22_0.02_265)] text-zinc-200"><SelectValue placeholder="Pricing" /></SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectItem value="ALL">All pricing</SelectItem>
            <SelectItem value="PER_JOB">Per job</SelectItem>
            <SelectItem value="PER_TOKEN">Per token</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Results */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-52 animate-pulse rounded-2xl bg-[oklch(0.12_0.014_265)]" />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[oklch(0.22_0.02_265)] bg-[oklch(0.12_0.014_265)] py-24 text-center">
          <Bot size={32} className="mb-3 text-[oklch(0.22_0.02_265)]" />
          <p className="font-medium text-[oklch(0.55_0.02_265)]">No agents match your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent, i) => (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.25, ease: 'easeOut' }}
              whileHover={{ y: -3, transition: { duration: 0.15 } }}
            >
              <Link href={`/${locale}/marketplace/${agent.id}`}>
                <div className="group relative overflow-hidden rounded-2xl border border-[oklch(0.22_0.02_265)] bg-[oklch(0.12_0.014_265)] p-5 shadow-lg shadow-black/30 hover:border-[oklch(0.32_0.04_265)] hover:shadow-[0_8px_32px_black/50] transition-all h-full flex flex-col">
                  {/* bg accent */}
                  <div className={`absolute right-0 top-0 h-24 w-24 -translate-y-8 translate-x-8 rounded-full bg-gradient-to-br ${AGENT_GRADIENTS[i % AGENT_GRADIENTS.length]} opacity-10 blur-2xl group-hover:opacity-20 transition-opacity`} />

                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${AGENT_GRADIENTS[i % AGENT_GRADIENTS.length]} text-white shadow-sm`}>
                        {agent.type === 'AI' ? <Bot size={18} /> : <User size={18} />}
                      </div>
                      <div>
                        <p className="font-semibold text-zinc-100 leading-tight">{agent.name}</p>
                        <p className="text-xs text-[oklch(0.55_0.02_265)]">{agent.provider?.displayName}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {agent.aggregateRating != null && (
                        <div className="flex items-center gap-1">
                          <Star size={11} className="text-amber-400 fill-amber-400" />
                          <span className="text-xs font-semibold text-zinc-300">{agent.aggregateRating.toFixed(1)}</span>
                        </div>
                      )}
                      {/* Agent type badge */}
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        agent.type === 'AI'
                          ? 'bg-[oklch(0.75_0.15_210/0.15)] text-[oklch(0.75_0.15_210)] border border-[oklch(0.75_0.15_210/0.25)]'
                          : 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                      }`}>
                        {agent.type === 'AI' ? '✦ AI' : '● HUMAN'}
                      </span>
                    </div>
                  </div>

                  <p className="text-sm text-[oklch(0.55_0.02_265)] line-clamp-2 flex-1 mb-3">{agent.description}</p>

                  <div className="flex flex-wrap gap-1 mb-4">
                    {agent.capabilityTags.slice(0, 3).map((tag) => (
                      <span key={tag} className="rounded-full bg-[oklch(0.22_0.02_265)] px-2 py-0.5 text-[11px] font-medium text-[oklch(0.55_0.02_265)]">{tag}</span>
                    ))}
                    {agent.capabilityTags.length > 3 && (
                      <span className="rounded-full bg-[oklch(0.22_0.02_265)] px-2 py-0.5 text-[11px] font-medium text-[oklch(0.45_0.015_265)]">+{agent.capabilityTags.length - 3}</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-[oklch(0.22_0.02_265)] pt-3">
                    <span className="text-sm font-semibold text-zinc-200">
                      {agent.pricingModel === 'PER_JOB'
                        ? `$${((agent.pricePerJob ?? 0) / 100).toFixed(2)}`
                        : `$${((agent.pricePerToken ?? 0) / 100000).toFixed(4)}`}
                      <span className="ml-1 text-xs font-normal text-[oklch(0.55_0.02_265)]">
                        {agent.pricingModel === 'PER_JOB' ? '/ job' : '/ token'}
                      </span>
                    </span>
                    <span className="flex items-center gap-1 text-xs text-[oklch(0.55_0.02_265)] group-hover:text-violet-300 transition-colors">
                      View <ArrowRight size={12} />
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex justify-center items-center gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-[oklch(0.22_0.02_265)] bg-[oklch(0.12_0.014_265)] px-3 py-1.5 text-sm text-[oklch(0.55_0.02_265)] hover:text-zinc-200 hover:border-[oklch(0.32_0.04_265)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ←
          </button>
          {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                p === page
                  ? 'border-violet-500/50 bg-violet-500/20 text-violet-300'
                  : 'border-[oklch(0.22_0.02_265)] bg-[oklch(0.12_0.014_265)] text-[oklch(0.55_0.02_265)] hover:text-zinc-200 hover:border-[oklch(0.32_0.04_265)]'
              }`}
            >
              {p}
            </button>
          ))}
          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-[oklch(0.22_0.02_265)] bg-[oklch(0.12_0.014_265)] px-3 py-1.5 text-sm text-[oklch(0.55_0.02_265)] hover:text-zinc-200 hover:border-[oklch(0.32_0.04_265)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
