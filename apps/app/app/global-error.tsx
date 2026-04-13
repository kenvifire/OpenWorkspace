'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: '#fff',
        }}
      >
        <div
          style={{
            maxWidth: 480,
            textAlign: 'center',
            padding: '2rem',
          }}
        >
          <div style={{ fontSize: 48, marginBottom: '1rem' }}>⚠️</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#888', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
            {error.message || 'An unexpected error occurred. Please try again.'}
          </p>
          {error.digest && (
            <p style={{ color: '#555', fontSize: '0.75rem', margin: '0 0 1.5rem', fontFamily: 'monospace' }}>
              Error ID: {error.digest}
            </p>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button
              onClick={reset}
              style={{
                padding: '0.5rem 1.25rem',
                background: '#fff',
                color: '#000',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '0.875rem',
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                padding: '0.5rem 1.25rem',
                background: 'transparent',
                color: '#888',
                border: '1px solid #333',
                borderRadius: 6,
                textDecoration: 'none',
                fontWeight: 500,
                fontSize: '0.875rem',
              }}
            >
              Go home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
