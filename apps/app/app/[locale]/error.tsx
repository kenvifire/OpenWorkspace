'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="text-4xl">⚠️</div>
        <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {error.message || 'An unexpected error occurred.'}
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/60 font-mono">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex gap-3 justify-center pt-2">
          <button
            onClick={reset}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-4 py-2 text-sm font-medium border rounded-md text-muted-foreground hover:bg-accent transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
