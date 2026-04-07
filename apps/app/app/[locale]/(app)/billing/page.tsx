'use client';

import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { workspacesApi, billingApi } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { CreditCard, TrendingUp, CheckCircle2, XCircle, DollarSign, ChevronRight } from 'lucide-react';
import { useState, Suspense } from 'react';
import { motion } from 'framer-motion';

function PaymentBanner() {
  const t = useTranslations('billing');
  const searchParams = useSearchParams();
  const paymentSuccess = searchParams.get('success') === '1';
  const paymentCancelled = searchParams.get('cancelled') === '1';
  if (!paymentSuccess && !paymentCancelled) return null;
  return paymentSuccess ? (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-800 bg-emerald-950/50 px-4 py-3.5 text-sm text-emerald-400"
    >
      <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
      {t('paymentSuccess')}
    </motion.div>
  ) : (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-sm text-muted-foreground"
    >
      <XCircle size={16} className="shrink-0 text-muted-foreground/70" />
      {t('paymentCancelled')}
    </motion.div>
  );
}

export default function BillingPage() {
  const t = useTranslations('billing');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');

  const { data: workspacesRaw } = useQuery({
    queryKey: ['workspaces'],
    queryFn: workspacesApi.list,
  });
  const workspaces: { id: string; name: string }[] = workspacesRaw ?? [];

  if (workspaces.length > 0 && !selectedWorkspaceId) {
    setSelectedWorkspaceId(workspaces[0].id);
  }

  const { data: summary, isLoading } = useQuery({
    queryKey: ['billing', selectedWorkspaceId],
    queryFn: () => billingApi.getCycleSummary(selectedWorkspaceId),
    enabled: !!selectedWorkspaceId,
  });

  const handleCheckout = async () => {
    if (!summary) return;
    const { url } = await billingApi.createCheckout(selectedWorkspaceId, { amountCents: summary.totalCents });
    if (url) window.location.href = url;
  };

  return (
    <div className="min-h-full p-8">
      <Suspense><PaymentBanner /></Suspense>

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8 flex items-end justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Select value={selectedWorkspaceId} onValueChange={(v) => setSelectedWorkspaceId(v ?? '')}>
          <SelectTrigger className="w-48 bg-card">
            <SelectValue placeholder={t('selectWorkspace')} />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {workspaces.map((ws) => (
              <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-36 animate-pulse rounded-2xl bg-muted" />
          <div className="h-64 animate-pulse rounded-2xl bg-muted" />
        </div>
      ) : !summary ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card py-24 text-center">
          <CreditCard size={32} className="mb-3 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground/70">{t('selectWorkspacePrompt')}</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="space-y-5"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2 relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-700 p-6 text-white shadow-sm">
              <div className="absolute right-0 top-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-card/5 blur-2xl" />
              <p className="text-sm font-medium text-muted-foreground/70">{t('currentCycleTotal')}</p>
              <p className="mt-2 text-5xl font-bold tracking-tight">{summary.totalFormatted}</p>
              <p className="mt-2 text-xs text-muted-foreground/70">
                {new Date(summary.periodStart).toLocaleDateString()} – {new Date(summary.periodEnd).toLocaleDateString()}
              </p>
            </div>
            <div className="flex flex-col rounded-2xl bg-card p-5 shadow-sm ring-1 ring-border">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-900/40">
                <DollarSign size={18} className="text-violet-400" />
              </div>
              <p className="text-sm font-medium text-foreground/80">{t('payThisCycle')}</p>
              <p className="mt-0.5 text-xs text-muted-foreground/70">{t('viaStripe')}</p>
              <Button
                onClick={handleCheckout}
                disabled={summary.totalCents === 0}
                className="mt-auto w-full"
              >
                {t('pay', { amount: summary.totalFormatted })}
              </Button>
            </div>
          </div>

          <div className="rounded-2xl bg-card p-6 shadow-sm ring-1 ring-border">
            <div className="mb-5 flex items-center gap-2">
              <TrendingUp size={16} className="text-muted-foreground/70" />
              <h2 className="font-semibold text-foreground">{t('breakdownByProject')}</h2>
            </div>

            {summary.byProject.length === 0 ? (
              <p className="text-sm text-muted-foreground/70">{t('noUsage')}</p>
            ) : (
              <div className="space-y-5">
                {summary.byProject.map((p: {
                  projectId: string;
                  projectName: string;
                  totalFormatted: string;
                  byAgent: { agentId: string; agentName: string; totalFormatted: string }[];
                }) => (
                  <div key={p.projectId}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-violet-900/200" />
                        <span className="font-semibold text-foreground">{p.projectName}</span>
                      </div>
                      <span className="font-bold text-foreground">{p.totalFormatted}</span>
                    </div>
                    <div className="ml-4 space-y-2 border-l-2 border-border/50 pl-4">
                      {p.byAgent.map((a) => (
                        <div key={a.agentId} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <ChevronRight size={12} className="text-muted-foreground/50" />
                            <span className="text-muted-foreground">{a.agentName}</span>
                          </div>
                          <span className="font-medium text-foreground/80">{a.totalFormatted}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 border-t border-border/50" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
