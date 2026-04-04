'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Sidebar } from '@/components/sidebar';
import { useAuth } from '@/contexts/auth';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/${locale}/sign-in`);
    }
  }, [loading, user, router, locale]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[oklch(0.09_0.012_265)]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[oklch(0.22_0.02_265)] border-t-violet-500" />
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden bg-[oklch(0.09_0.012_265)]">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </AuthGuard>
  );
}
