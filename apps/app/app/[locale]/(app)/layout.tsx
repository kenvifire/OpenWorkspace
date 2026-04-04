'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Sidebar } from '@/components/sidebar';
import { useAuth } from '@/contexts/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, Loader2 } from 'lucide-react';

function MfaChallenge() {
  const { verifyMfa, signOut } = useAuth();
  const locale = useLocale();
  const router = useRouter();
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (token.length !== 6) return;
    setLoading(true);
    setError('');
    try {
      await verifyMfa(token);
    } catch {
      setError('Invalid code. Please try again.');
      setToken('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Shield size={22} className="text-primary" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: 'var(--font-syne)' }}>
              Two-Factor Authentication
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter the 6-digit code from your authenticator app
            </p>
          </div>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <Input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="000000"
            value={token}
            onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
            className="text-center text-2xl tracking-[0.5em] font-mono"
            autoFocus
            autoComplete="one-time-code"
          />
          {error && <p className="text-center text-xs text-red-400">{error}</p>}
          <Button
            type="submit"
            className="w-full"
            disabled={token.length !== 6 || loading}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : 'Verify'}
          </Button>
        </form>

        <button
          type="button"
          className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={async () => { await signOut(); router.push(`/${locale}/sign-in`); }}
        >
          Sign out and use a different account
        </button>
      </div>
    </div>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, mfaPending } = useAuth();
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/${locale}/sign-in`);
    }
  }, [loading, user, router, locale]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      </div>
    );
  }

  if (!user) return null;

  if (mfaPending) return <MfaChallenge />;

  return <>{children}</>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </AuthGuard>
  );
}
