'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { marketplaceApi } from '@/lib/api';
import type { MarketplaceSearchParams, Agent } from '@openworkspace/api-types';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8"
      >
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold text-zinc-900">Marketplace</h1>
          <span className="flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-600">
            <Sparkles size={10} /> Live
          </span>
        </div>
        <p className="text-sm text-zinc-500">Browse AI and human agents to hire for your projects</p>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="mb-6 flex flex-wrap gap-3"
      >
        <div className="relative flex-1 min-w-52">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search agents…"
            className="pl-9 bg-white"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={type} onValueChange={(v) => { setType(v ?? 'ALL'); setPage(1); }}>
          <SelectTrigger className="w-36 bg-white"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectItem value="ALL">All types</SelectItem>
            <SelectItem value="AI">AI agents</SelectItem>
            <SelectItem value="HUMAN">Human agents</SelectItem>
          </SelectContent>
        </Select>
        <Select value={pricing} onValueChange={(v) => { setPricing(v ?? 'ALL'); setPage(1); }}>
          <SelectTrigger className="w-40 bg-white"><SelectValue placeholder="Pricing" /></SelectTrigger>
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
            <div key={i} className="h-52 animate-pulse rounded-2xl bg-zinc-200" />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 bg-white py-24 text-center">
          <Bot size={32} className="mb-3 text-zinc-300" />
          <p className="font-medium text-zinc-500">No agents match your filters</p>
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
                <div className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/80 hover:shadow-md transition-shadow h-full flex flex-col">
                  {/* bg accent */}
                  <div className={`absolute right-0 top-0 h-24 w-24 -translate-y-8 translate-x-8 rounded-full bg-gradient-to-br ${AGENT_GRADIENTS[i % AGENT_GRADIENTS.length]} opacity-10 blur-2xl group-hover:opacity-20 transition-opacity`} />

                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${AGENT_GRADIENTS[i % AGENT_GRADIENTS.length]} text-white shadow-sm`}>
                        {agent.type === 'AI' ? <Bot size={18} /> : <User size={18} />}
                      </div>
                      <div>
                        <p className="font-semibold text-zinc-900 leading-tight">{agent.name}</p>
                        <p className="text-xs text-zinc-400">{agent.provider?.displayName}</p>
                      </div>
                    </div>
                    {agent.aggregateRating != null && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Star size={11} className="text-amber-400 fill-amber-400" />
                        <span className="text-xs font-semibold text-zinc-700">{agent.aggregateRating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>

                  <p className="text-sm text-zinc-500 line-clamp-2 flex-1 mb-3">{agent.description}</p>

                  <div className="flex flex-wrap gap-1 mb-4">
                    {agent.capabilityTags.slice(0, 3).map((tag) => (
                      <span key={tag} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500">{tag}</span>
                    ))}
                    {agent.capabilityTags.length > 3 && (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-400">+{agent.capabilityTags.length - 3}</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-zinc-100 pt-3">
                    <span className="text-sm font-semibold text-zinc-900">
                      {agent.pricingModel === 'PER_JOB'
                        ? `$${((agent.pricePerJob ?? 0) / 100).toFixed(2)}`
                        : `$${((agent.pricePerToken ?? 0) / 100000).toFixed(4)}`}
                      <span className="ml-1 text-xs font-normal text-zinc-400">
                        {agent.pricingModel === 'PER_JOB' ? '/ job' : '/ token'}
                      </span>
                    </span>
                    <span className="flex items-center gap-1 text-xs text-zinc-400 group-hover:text-violet-600 transition-colors">
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
        <div className="mt-8 flex justify-center items-center gap-3">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="bg-white">Previous</Button>
          <span className="text-sm text-zinc-500">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="bg-white">Next</Button>
        </div>
      )}
    </div>
  );
}
