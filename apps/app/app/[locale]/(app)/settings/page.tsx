'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useAuth } from '@/contexts/auth';
import { auth } from '@/lib/firebase';
import QRCode from 'react-qr-code';
import { twoFactorApi, usersApi } from '@/lib/api';
import {
  updateProfile,
  updatePassword,
  verifyBeforeUpdateEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  User,
  Shield,
  Globe,
  CreditCard,
  Check,
  AlertCircle,
  Loader2,
  ChevronRight,
  Eye,
  EyeOff,
} from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

const AVATAR_GRADIENTS = [
  'from-violet-600 to-purple-700',
  'from-sky-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-600',
  'from-pink-500 to-rose-600',
  'from-slate-500 to-zinc-600',
];

const tabs = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'account', label: 'Account', icon: Shield },
  { id: 'language', label: 'Language', icon: Globe },
  { id: 'billing', label: 'Billing', icon: CreditCard },
];

const languages = [
  { code: 'en', label: 'English', nativeLabel: 'English', flag: '🇺🇸' },
  { code: 'zh', label: 'Chinese', nativeLabel: '中文', flag: '🇨🇳' },
];

function getFriendlyFirebaseError(code: string, fallback: string): string {
  switch (code) {
    case 'auth/wrong-password':
      return 'Incorrect password';
    case 'auth/email-already-in-use':
      return 'That email is already in use';
    case 'auth/invalid-email':
      return 'Invalid email address';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters';
    case 'auth/requires-recent-login':
      return 'Please sign out and sign in again before making this change';
    default:
      return fallback;
  }
}

// ─── Profile Tab ─────────────────────────────────────────────────────────────

function ProfileTab({ user }: { user: NonNullable<ReturnType<typeof useAuth>['user']> }) {
  const [displayName, setDisplayName] = useState(user.displayName ?? '');
  const [avatarGradient, setAvatarGradient] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    setDisplayName(user.displayName ?? '');
  }, [user.displayName]);

  const initials = displayName.trim()
    ? displayName.trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : (user.email?.[0] ?? '?').toUpperCase();

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await updateProfile(auth.currentUser!, { displayName });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (e: any) {
      setSaveError(e.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const creationTime = user.metadata.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '—';

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Profile</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your public profile information.</p>
      </div>

      {/* Avatar */}
      <div className="flex flex-col gap-3">
        <div
          className={cn(
            'flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br text-xl font-bold text-white shadow-lg',
            AVATAR_GRADIENTS[avatarGradient],
          )}
        >
          {initials}
        </div>
        <div className="flex items-center gap-2">
          {AVATAR_GRADIENTS.map((g, i) => (
            <button
              key={i}
              onClick={() => setAvatarGradient(i)}
              className={cn(
                'h-6 w-6 rounded-full bg-gradient-to-br transition-all',
                g,
                i === avatarGradient
                  ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110'
                  : 'opacity-70 hover:opacity-100 hover:scale-105',
              )}
              aria-label={`Avatar color ${i + 1}`}
            />
          ))}
        </div>
      </div>

      <Separator />

      {/* Form */}
      <div className="flex flex-col gap-4 max-w-md">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="displayName">Display name</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Email</Label>
          <Input value={user.email ?? ''} readOnly className="opacity-60 cursor-not-allowed" />
          <p className="text-xs text-muted-foreground">To change your email, go to the Account tab.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Account created</Label>
          <p className="text-sm text-muted-foreground py-1">{creationTime}</p>
        </div>

        {saveError && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle size={14} />
            {saveError}
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <Button
            onClick={handleSave}
            disabled={!displayName.trim() || saving}
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin mr-1.5" />
            ) : saveSuccess ? (
              <Check size={14} className="mr-1.5 text-green-400" />
            ) : null}
            {saveSuccess ? 'Saved!' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Account Tab ─────────────────────────────────────────────────────────────

function AccountTab({ user }: { user: NonNullable<ReturnType<typeof useAuth>['user']> }) {
  const isPasswordUser = user.providerData.some((p) => p.providerId === 'password');

  // 2FA state
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [tfaStep, setTfaStep] = useState<'idle' | 'loading' | 'scan' | 'verify' | 'disabling'>('idle');
  const [setupData, setSetupData] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [tfaToken, setTfaToken] = useState('');
  const [tfaSaving, setTfaSaving] = useState(false);
  const [tfaError, setTfaError] = useState('');

  useEffect(() => {
    if (user) {
      usersApi.me().then((p) => setTotpEnabled(p.totpEnabled)).catch(() => {});
    }
  }, [user]);

  const handleStartEnable = async () => {
    setTfaStep('loading');
    setTfaError('');
    try {
      const data = await twoFactorApi.setup();
      setSetupData(data);
      setTfaStep('scan');
    } catch {
      setTfaStep('idle');
    }
  };

  const handleEnableTfa = async () => {
    if (!setupData) return;
    setTfaSaving(true);
    setTfaError('');
    try {
      await twoFactorApi.enable({ secret: setupData.secret, token: tfaToken });
      setTotpEnabled(true);
      setTfaStep('idle');
      setTfaToken('');
    } catch {
      setTfaError('Invalid code. Please try again.');
    } finally {
      setTfaSaving(false);
    }
  };

  const handleDisableTfa = async () => {
    setTfaSaving(true);
    setTfaError('');
    try {
      await twoFactorApi.disable({ token: tfaToken });
      setTotpEnabled(false);
      setTfaStep('idle');
      setTfaToken('');
    } catch {
      setTfaError('Invalid code. Please try again.');
    } finally {
      setTfaSaving(false);
    }
  };

  // Email section
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailStep, setEmailStep] = useState<'form' | 'sent'>('form');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState('');

  const handleEmailChange = async () => {
    setEmailSaving(true);
    setEmailError('');
    try {
      const cred = EmailAuthProvider.credential(user.email!, emailPassword);
      await reauthenticateWithCredential(auth.currentUser!, cred);
      await verifyBeforeUpdateEmail(auth.currentUser!, newEmail);
      setEmailStep('sent');
    } catch (e: any) {
      setEmailError(getFriendlyFirebaseError(e.code, e.message ?? 'Failed to send verification'));
    } finally {
      setEmailSaving(false);
    }
  };

  // Password section
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  const handlePasswordChange = async () => {
    setPwError('');
    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match');
      return;
    }
    setPwSaving(true);
    try {
      const cred = EmailAuthProvider.credential(user.email!, currentPassword);
      await reauthenticateWithCredential(auth.currentUser!, cred);
      await updatePassword(auth.currentUser!, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwSuccess(true);
      setTimeout(() => setPwSuccess(false), 2000);
    } catch (e: any) {
      setPwError(getFriendlyFirebaseError(e.code, e.message ?? 'Failed to update password'));
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Account</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Update your email address and password.</p>
      </div>

      {/* Email card */}
      <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
        <div>
          <h3 className="font-medium text-foreground">Email address</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Current: {user.email}</p>
        </div>

        {emailStep === 'sent' ? (
          <div className="flex items-start gap-3 rounded-lg bg-emerald-950/40 border border-emerald-800/50 px-4 py-3 text-sm text-emerald-400">
            <Check size={15} className="mt-0.5 shrink-0" />
            <span>Check your new inbox — click the link to confirm the change.</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3 max-w-sm">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="newEmail">New email address</Label>
              <Input
                id="newEmail"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="new@example.com"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emailPassword">Confirm password</Label>
              <Input
                id="emailPassword"
                type="password"
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
                placeholder="Your current password"
              />
            </div>
            {emailError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle size={14} />
                {emailError}
              </div>
            )}
            <Button
              onClick={handleEmailChange}
              disabled={!newEmail || !emailPassword || emailSaving}
              variant="outline"
              className="w-fit"
            >
              {emailSaving && <Loader2 size={14} className="animate-spin mr-1.5" />}
              Send verification email
            </Button>
          </div>
        )}
      </div>

      {/* Password card */}
      {!isPasswordUser ? (
        <div className="flex items-start gap-3 rounded-xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground">
          <Shield size={16} className="mt-0.5 shrink-0 text-sky-400" />
          <span>Your account uses Google sign-in. Password changes are managed through Google.</span>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
          <div>
            <h3 className="font-medium text-foreground">Password</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Choose a strong password.</p>
          </div>

          <div className="flex flex-col gap-3 max-w-sm">
            {/* Current password */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="currentPw">Current password</Label>
              <div className="relative">
                <Input
                  id="currentPw"
                  type={showCurrentPw ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showCurrentPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="newPw">New password</Label>
              <div className="relative">
                <Input
                  id="newPw"
                  type={showNewPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showNewPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirmPw">Confirm new password</Label>
              <div className="relative">
                <Input
                  id="confirmPw"
                  type={showConfirmPw ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPw((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {pwError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle size={14} />
                {pwError}
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <Button
                onClick={handlePasswordChange}
                disabled={!currentPassword || !newPassword || !confirmPassword || pwSaving}
                variant="outline"
                className="w-fit"
              >
                {pwSaving ? (
                  <Loader2 size={14} className="animate-spin mr-1.5" />
                ) : pwSuccess ? (
                  <Check size={14} className="mr-1.5 text-green-400" />
                ) : null}
                {pwSuccess ? 'Updated!' : 'Update password'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Two-Factor Authentication card */}
      <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Shield size={18} className="text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">Two-Factor Authentication</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Add an extra layer of security using an authenticator app.
              </p>
            </div>
          </div>
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-medium',
              totpEnabled
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {totpEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>

        {/* Idle state */}
        {tfaStep === 'idle' && (
          <div>
            {totpEnabled ? (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/50 hover:bg-destructive/10"
                onClick={() => { setTfaStep('disabling'); setTfaToken(''); setTfaError(''); }}
              >
                Disable 2FA
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={handleStartEnable}>
                Enable 2FA
              </Button>
            )}
          </div>
        )}

        {/* Loading */}
        {tfaStep === 'loading' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 size={14} className="animate-spin" />
            Loading setup…
          </div>
        )}

        {/* Scan QR */}
        {tfaStep === 'scan' && setupData && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="rounded-xl bg-white p-3">
              <QRCode value={setupData.otpauthUrl} size={180} />
            </div>
            <p className="text-xs text-muted-foreground text-center max-w-xs">
              Scan this QR code with Google Authenticator, Authy, or any TOTP app.
            </p>
            <details className="w-full">
              <summary className="text-xs text-muted-foreground cursor-pointer">
                Can&apos;t scan? Enter key manually
              </summary>
              <code className="mt-2 block break-all rounded bg-muted px-3 py-2 text-xs font-mono text-foreground">
                {setupData.secret}
              </code>
            </details>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setTfaStep('idle')}>Cancel</Button>
              <Button size="sm" onClick={() => setTfaStep('verify')}>I&apos;ve scanned it →</Button>
            </div>
          </div>
        )}

        {/* Verify token to enable */}
        {tfaStep === 'verify' && (
          <div className="space-y-3 max-w-sm">
            <p className="text-sm text-muted-foreground">Enter the 6-digit code from your app to confirm setup:</p>
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              className="text-center text-xl tracking-[0.4em] font-mono"
              value={tfaToken}
              onChange={(e) => setTfaToken(e.target.value.replace(/\D/g, ''))}
            />
            {tfaError && <p className="text-xs text-red-400">{tfaError}</p>}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setTfaStep('idle'); setTfaToken(''); setTfaError(''); }}>Cancel</Button>
              <Button
                size="sm"
                disabled={tfaToken.length !== 6 || tfaSaving}
                onClick={handleEnableTfa}
              >
                {tfaSaving ? <Loader2 size={14} className="animate-spin" /> : 'Enable 2FA'}
              </Button>
            </div>
          </div>
        )}

        {/* Disable flow */}
        {tfaStep === 'disabling' && (
          <div className="space-y-3 max-w-sm">
            <p className="text-sm text-muted-foreground">Enter your current 6-digit code to disable 2FA:</p>
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              className="text-center text-xl tracking-[0.4em] font-mono"
              value={tfaToken}
              onChange={(e) => setTfaToken(e.target.value.replace(/\D/g, ''))}
            />
            {tfaError && <p className="text-xs text-red-400">{tfaError}</p>}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setTfaStep('idle'); setTfaToken(''); setTfaError(''); }}>Cancel</Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={tfaToken.length !== 6 || tfaSaving}
                onClick={handleDisableTfa}
              >
                {tfaSaving ? <Loader2 size={14} className="animate-spin" /> : 'Disable 2FA'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Language Tab ─────────────────────────────────────────────────────────────

function LanguageTab() {
  const locale = useLocale();
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Language</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Choose the display language for your interface.</p>
      </div>

      <div className="flex gap-4">
        {languages.map((lang) => {
          const active = locale === lang.code;
          return (
            <button
              key={lang.code}
              onClick={() => router.push(`/${lang.code}/settings`)}
              className={cn(
                'relative rounded-xl border-2 p-5 cursor-pointer transition-all w-40 text-left',
                active
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card hover:border-primary/50 hover:bg-muted/50',
              )}
            >
              {active && (
                <span className="absolute top-3 right-3 text-primary">
                  <Check size={15} />
                </span>
              )}
              <div className="text-2xl mb-2">{lang.flag}</div>
              <div className="text-xl font-bold text-foreground">{lang.nativeLabel}</div>
              <div className="text-sm text-muted-foreground mt-0.5">{lang.label}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Billing Tab ─────────────────────────────────────────────────────────────

function BillingTab() {
  const locale = useLocale();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Billing</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your subscription, usage, and payment details.</p>
      </div>

      {/* Usage card */}
      <div className="rounded-xl border border-border bg-card p-5 flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <CreditCard size={18} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground">Billing &amp; Usage</h3>
          <p className="text-sm text-muted-foreground mt-1">
            View your current billing cycle, usage breakdown, and make payments.
          </p>
          <div className="mt-4">
            <Link
              href={`/${locale}/billing`}
              className={cn(
                buttonVariants({ variant: 'default', size: 'sm' }),
                'gap-1.5',
              )}
            >
              Go to Billing
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* Payment methods card */}
      <div className="rounded-xl border border-border bg-card p-5 flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
          <Shield size={18} className="text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-foreground">Payment Methods</h3>
            <Badge variant="secondary" className="text-xs">Coming soon</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your saved payment methods via Stripe.
          </p>
          <p className="text-xs text-muted-foreground/70 mt-2">
            Payment method management requires Stripe Customer setup. Contact support to configure.
          </p>
          <div className="mt-4">
            <Button variant="outline" size="sm" disabled className="gap-1.5 opacity-50 cursor-not-allowed">
              Go to Stripe Dashboard
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Settings Page ───────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-muted-foreground text-sm">Not signed in.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-syne)' }}>
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
      </div>

      {/* Horizontal tab nav */}
      <nav className="flex items-center gap-1 border-b border-border mb-8">
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Content */}
      <div>
        {activeTab === 'profile' && <ProfileTab user={user} />}
        {activeTab === 'account' && <AccountTab user={user} />}
        {activeTab === 'language' && <LanguageTab />}
        {activeTab === 'billing' && <BillingTab />}
      </div>
    </div>
  );
}
