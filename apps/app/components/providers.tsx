'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AbstractIntlMessages, NextIntlClientProvider } from 'next-intl';
import { queryClient } from '@/lib/query-client';
import { AuthProvider } from '@/contexts/auth';
import { ThemeProvider } from '@/contexts/theme';
import { useEffect } from 'react';

interface ProvidersProps {
  children: React.ReactNode;
  locale: string;
  messages: AbstractIntlMessages;
  lang?: string;
  initialTheme: string;
}

export function Providers({ children, locale, messages, lang, initialTheme }: ProvidersProps) {
  useEffect(() => {
    if (lang) {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    }
  }, [lang]);

  return (
    <AuthProvider>
      <ThemeProvider initialTheme={initialTheme}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <QueryClientProvider client={queryClient}>
            {children}
            {process.env.NODE_ENV === 'development' && <ReactQueryDevtools />}
          </QueryClientProvider>
        </NextIntlClientProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
