'use client';

import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { workspacesApi, billingApi } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { CreditCard, TrendingUp, CheckCircle2, XCircle, DollarSign, ChevronRight } from 'lucide-react';
import { useState, Suspense } from 'react';
import { motion } from 'framer-motion';

function PaymentBanner() {
  const searchParams = useSearchParams();
  const paymentSuccess = searchParams.get('success') === '1';
  const paymentCancelled = searchParams.get('cancelled') === '1';
  if (!paymentSuccess && !paymentCancelled) return null;
  return paymentSuccess ? (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-800"
    >
      <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
      Payment successful — thank you! Your balance has been updated.
    </motion.div>
  ) : (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3.5 text-sm text-zinc-600"
    >
      <XCircle size={16} className="shrink-0 text-zinc-400" />
      Payment cancelled. No charge was made.
    </motion.div>
  );
}

export default function BillingPage() {
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
          <h1 className="text-2xl font-bold text-zinc-900">Billing</h1>
          <p className="mt-1 text-sm text-zinc-500">Current billing cycle usage and payments</p>
        </div>
        <Select value={selectedWorkspaceId} onValueChange={(v) => setSelectedWorkspaceId(v ?? '')}>
          <SelectTrigger className="w-48 bg-white">
            <SelectValue placeholder="Select workspace" />
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
          <div className="h-36 animate-pulse rounded-2xl bg-zinc-200" />
          <div className="h-64 animate-pulse rounded-2xl bg-zinc-200" />
        </div>
      ) : !summary ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 bg-white py-24 text-center">
          <CreditCard size={32} className="mb-3 text-zinc-300" />
          <p className="text-sm text-zinc-400">Select a workspace to view billing</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="space-y-5"
        >
          {/* Top cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Total */}
            <div className="sm:col-span-2 relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-700 p-6 text-white shadow-sm">
              <div className="absolute right-0 top-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-white/5 blur-2xl" />
              <p className="text-sm font-medium text-zinc-400">Current cycle total</p>
              <p className="mt-2 text-5xl font-bold tracking-tight">{summary.totalFormatted}</p>
              <p className="mt-2 text-xs text-zinc-400">
                {new Date(summary.periodStart).toLocaleDateString()} – {new Date(summary.periodEnd).toLocaleDateString()}
              </p>
            </div>
            {/* Pay card */}
            <div className="flex flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/80">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
                <DollarSign size={18} className="text-violet-600" />
              </div>
              <p className="text-sm font-medium text-zinc-700">Pay this cycle</p>
              <p className="mt-0.5 text-xs text-zinc-400">Securely via Stripe</p>
              <Button
                onClick={handleCheckout}
                disabled={summary.totalCents === 0}
                className="mt-auto w-full"
              >
                Pay {summary.totalFormatted}
              </Button>
            </div>
          </div>

          {/* Breakdown */}
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/80">
            <div className="mb-5 flex items-center gap-2">
              <TrendingUp size={16} className="text-zinc-400" />
              <h2 className="font-semibold text-zinc-900">Breakdown by project</h2>
            </div>

            {summary.byProject.length === 0 ? (
              <p className="text-sm text-zinc-400">No usage this cycle</p>
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
                        <div className="h-2 w-2 rounded-full bg-violet-500" />
                        <span className="font-semibold text-zinc-800">{p.projectName}</span>
                      </div>
                      <span className="font-bold text-zinc-900">{p.totalFormatted}</span>
                    </div>
                    <div className="ml-4 space-y-2 border-l-2 border-zinc-100 pl-4">
                      {p.byAgent.map((a) => (
                        <div key={a.agentId} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <ChevronRight size={12} className="text-zinc-300" />
                            <span className="text-zinc-600">{a.agentName}</span>
                          </div>
                          <span className="font-medium text-zinc-700">{a.totalFormatted}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 border-t border-zinc-100" />
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
